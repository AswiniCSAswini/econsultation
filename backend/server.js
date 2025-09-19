// server.js
// Backend server using Supabase client for eConsult sentiment analysis

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { callGemini } from './gemini_client.js';
import { computeKeywords, sampleRepresentativeComments } from './utils.js';

dotenv.config();

// ✅ Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const app = express();
app.use(cors());
app.use(bodyParser.json());

/**
 * Helper: build prompt for batch comment classification
 */
function buildBatchCommentPrompt(comments, draftTitle = '') {
  const safe = comments.map((c, i) => {
    const text = c.comment_text.replace(/\n/g, ' ').replace(/"/g, '\\"').slice(0, 800);
    return `${i + 1}) ID:${c.id} "${text}"`;
  }).join('\n');

  return `You are an assistant that classifies public consultation comments relative to a policy draft.

DRAFT_TITLE: "${draftTitle}"

COMMENTS:
${safe}

Task: For each comment, return ONLY a JSON array of objects like this:
[
  {"id": <commentId>, "sentiment":"Positive" | "Neutral" | "Negative", "confidence":0.00}
]`;
}

/**
 * Helper: build overall draft analysis prompt
 */
function buildOverallPrompt({ title, total_comments, sentiment_counts, top_phrases, sample_comments, stakeholders }) {
  const sc = JSON.stringify(sentiment_counts);
  const phrases = (top_phrases || []).slice(0, 12).map(p => p.word).join(', ');
  const sampleText = (sample_comments || []).map((s, i) => `${i + 1}) ${s.replace(/\n/g, ' ').slice(0, 600)}`).join('\n');
  const stakeholderText = JSON.stringify(stakeholders);

  return `You are an expert policy analyst.

DRAFT_TITLE: ${title}
TOTAL_COMMENTS: ${total_comments}
SENTIMENT_COUNTS: ${sc}
TOP_PHRASES: ${phrases}
STAKEHOLDER_COMMENTS: ${stakeholderText}

SAMPLE_COMMENTS:
${sampleText}

Task:
1) Give overall sentiment (positive / mixed / negative).
2) Identify top 2 themes requiring attention.
3) Provide one clear recommendation for officials.
4) Suggest at least one perspective from citizens and one from government stakeholders.

Return ONLY JSON:
{
  "draft_summary":"...",
  "top_themes":["..."],
  "priority_recommendation":"...",
  "stakeholder_suggestions": {
     "citizens": ["..."],
     "government": ["..."]
  }
}`;
}

/**
 * Endpoint: trigger analysis for a draft
 */
app.post('/api/analyze/:draftId', async (req, res) => {
  const draftId = req.params.draftId;

  try {
    // 1) Fetch comments + section info
    const { data: comments, error: commentsErr } = await supabase
      .from('comments')
      .select('*,sections(section_code, section_title)')
      .eq('draft_id', draftId)
      .order('id', { ascending: true });

    if (commentsErr) throw commentsErr;
    if (!comments || comments.length === 0) return res.status(404).json({ error: 'No comments found for this draft' });

    // 2) Batch classify comments
    const batchSize = 8;
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize).filter(c => !c.analyzed_at);
      if (batch.length === 0) continue;

      const prompt = buildBatchCommentPrompt(batch, comments[0]?.title || '');
      const g = await callGemini(prompt, { temperature: 0.0, max_tokens: 600 });

      // Robust parsing of Gemini batch response
      let results = [];
      try {
        if (g.text) {
          const cleaned = g.text.replace(/```(json)?/gi, '').trim();
          results = JSON.parse(cleaned);
        }
      } catch (err) {
        console.warn("❌ Could not parse Gemini response for batch:", g.text, err);
      }

      if (results && Array.isArray(results)) {
        for (const r of results) {
          await supabase.from('comments').update({
            sentiment: r.sentiment || 'Neutral',
            confidence: r.confidence || 0.75,
            gemini_response: g,
            analyzed_at: new Date().toISOString()
          }).eq('id', r.id);
        }
      }
    }

    // 3) Aggregates
    const { data: allComments } = await supabase
      .from('comments')
      .select('id, comment_text, sentiment, stakeholder_type, analyzed_at')
      .eq('draft_id', draftId)
      .order('id', { ascending: true });

    const sentiment_counts = {};
    allComments.forEach(r => {
      sentiment_counts[r.sentiment || 'Neutral'] = (sentiment_counts[r.sentiment || 'Neutral'] || 0) + 1;
    });

    const texts = allComments.map(r => r.comment_text);
    const top_keywords = computeKeywords(texts, 60);
    const sample_comments = sampleRepresentativeComments(allComments, sentiment_counts);

    // Group stakeholders for summary
    const stakeholders = {
      citizens: allComments.filter(c => c.stakeholder_type === 'citizen').slice(0, 5).map(c => c.comment_text),
      government: allComments.filter(c => c.stakeholder_type === 'government').slice(0, 5).map(c => c.comment_text)
    };

    // 4) Overall summary
    const { data: draftRes } = await supabase.from('drafts').select('title').eq('id', draftId).single();
    const title = draftRes?.title || draftId;

    const overallPrompt = buildOverallPrompt({
      title,
      total_comments: allComments.length,
      sentiment_counts,
      top_phrases: top_keywords,
      sample_comments,
      stakeholders
    });

    const overallResp = await callGemini(overallPrompt, { temperature: 0.0, max_tokens: 600 });

    // Robust parsing for overall summary
    let draft_summary = '';
    let top_themes = [];
    let priority_recommendation = '';
    let stakeholder_suggestions = {};
    try {
      if (overallResp.text) {
        const cleaned = overallResp.text.replace(/```(json)?/gi, '').trim();
        const obj = JSON.parse(cleaned);
        draft_summary = obj.draft_summary || '';
        top_themes = obj.top_themes || [];
        priority_recommendation = obj.priority_recommendation || '';
        stakeholder_suggestions = obj.stakeholder_suggestions || {};
      }
    } catch (err) {
      console.warn("❌ Could not parse overall Gemini response:", overallResp.text, err);
      draft_summary = 'Summary unavailable (parse error).';
    }

    // 5) Persist analysis run
    await supabase.from('draft_analysis_run').insert([{
      draft_id: draftId,
      total_comments: allComments.length,
      sentiment_counts,
      top_keywords,
      draft_summary,
      stakeholder_suggestions,
      gemini_response: overallResp
    }]);

    res.json({
      status: 'ok',
      sentiment_counts,
      top_keywords,
      draft_summary,
      top_themes,
      priority_recommendation,
      stakeholder_suggestions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Basic endpoints
app.get('/api/drafts', async (req, res) => {
  try {
    const { data: rows, error } = await supabase.from('drafts').select('*').order('id', { ascending: true });
    if (error) throw error;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/drafts/:id/analysis', async (req, res) => {
  const id = req.params.id;
  try {
    const { data: comments } = await supabase
      .from('comments')
      .select('id, comment_text, stakeholder_type, sentiment, confidence, sections(section_code)')
      .eq('draft_id', id)
      .order('id', { ascending: true })
      .limit(200);

    const sentiment_counts = {};
    comments.forEach(r => {
      sentiment_counts[r.sentiment || 'Neutral'] = (sentiment_counts[r.sentiment || 'Neutral'] || 0) + 1;
    });

    const { data: runs } = await supabase
      .from('draft_analysis_run')
      .select('*')
      .eq('draft_id', id)
      .order('run_at', { ascending: false })
      .limit(1);

    res.json({ sentiment_counts, comments, last_run: runs[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
