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

// Helper: build prompt for a single comment
function buildCommentPrompt(comment, draftTitle = '') {
  const safe = comment.replace(/\n/g, ' ').replace(/"/g, '\\"').slice(0, 1800);
  return `You are an assistant that classifies public consultation comments relative to a policy draft.
COMMENT: "${safe}"
DRAFT_TITLE: "${draftTitle}"
Task: Return ONLY a JSON object with these exact fields:
{"sentiment":"Positive" | "Neutral" | "Negative", "confidence":0.00}
Do NOT include any other text.`;
}

// Helper: build overall summary prompt
function buildOverallPrompt({ title, total_comments, sentiment_counts, top_phrases, sample_comments }) {
  const sc = JSON.stringify(sentiment_counts);
  const phrases = (top_phrases || []).slice(0, 12).map(p => p.word).join(', ');
  const sampleText = (sample_comments || []).map((s, i) => `${i + 1}) ${s.replace(/\n/g, ' ').slice(0, 600)}`).join('\n');
  return `You are an expert policy analyst.

DRAFT_TITLE: ${title}
TOTAL_COMMENTS: ${total_comments}
SENTIMENT_COUNTS: ${sc}
TOP_PHRASES: ${phrases}
SAMPLE_COMMENTS:
${sampleText}

Task:
Write an executive summary (2-4 sentences) that:
1) States the overall sentiment (e.g., mostly negative / mixed / mostly positive).
2) Identifies the top 2 themes that require attention.
3) Gives one prioritized, concise recommendation for officials.

Return ONLY a JSON object with keys:
{"draft_summary":"...","top_themes":["..."],"priority_recommendation":"..."}
Do not include extra text.`;
}

// Endpoint: trigger analysis for a draft
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

    // 2) Classify comments (batching)
    const batchSize = 8;
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      for (const c of batch) {
        if (c.analyzed_at) continue;
        const prompt = buildCommentPrompt(c.comment_text, c.title || '');
        const g = await callGemini(prompt, { temperature: 0.0, max_tokens: 200 });

        let sentiment = 'Neutral';
        let confidence = 0.75;

        try {
          if (g && g.output && g.output.text) {
            const obj = JSON.parse(g.output.text);
            sentiment = obj.sentiment || sentiment;
            confidence = typeof obj.confidence === 'number' ? obj.confidence : confidence;
          }
        } catch {}

        // Persist comment analysis
        await supabase.from('comments').update({
          sentiment,
          confidence,
          gemini_response: g,
          analyzed_at: new Date().toISOString()
        }).eq('id', c.id);
      }
    }

    // 3) Aggregates
    const { data: counts } = await supabase
      .from('comments')
      .select('sentiment, count:id', { count: 'exact' })
      .eq('draft_id', draftId)
      .group('sentiment');

    const sentiment_counts = {};
    if (counts) counts.forEach(r => sentiment_counts[r.sentiment || 'Neutral'] = parseInt(r.count, 10));

    const { data: allComments } = await supabase
      .from('comments')
      .select('comment_text, sentiment, id, stakeholder_type, analyzed_at')
      .eq('draft_id', draftId)
      .order('id', { ascending: true });

    const texts = allComments.map(r => r.comment_text);
    const top_keywords = computeKeywords(texts, 60);
    const sample_comments = sampleRepresentativeComments(allComments, sentiment_counts);

    // 4) Overall summary
    const { data: draftRes } = await supabase.from('drafts').select('title').eq('id', draftId).single();
    const title = draftRes?.title || draftId;

    const overallPrompt = buildOverallPrompt({
      title,
      total_comments: allComments.length,
      sentiment_counts,
      top_phrases: top_keywords,
      sample_comments
    });

    const overallResp = await callGemini(overallPrompt, { temperature: 0.0, max_tokens: 400 });

    let draft_summary = '';
    let top_themes = [];
    let priority_recommendation = '';
    try {
      if (overallResp && overallResp.output && overallResp.output.text) {
        const obj = JSON.parse(overallResp.output.text);
        draft_summary = obj.draft_summary || '';
        top_themes = obj.top_themes || [];
        priority_recommendation = obj.priority_recommendation || '';
      }
    } catch {
      draft_summary = 'Summary unavailable (parse error).';
    }

    // Persist analysis run
    await supabase.from('draft_analysis_run').insert([{
      draft_id: draftId,
      total_comments: allComments.length,
      sentiment_counts,
      top_keywords,
      draft_summary,
      gemini_response: overallResp
    }]);

    res.json({
      status: 'ok',
      sentiment_counts,
      top_keywords,
      draft_summary,
      top_themes,
      priority_recommendation
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
    const { data: counts } = await supabase
      .from('comments')
      .select('sentiment, count:id', { count: 'exact' })
      .eq('draft_id', id)
      .group('sentiment');

    const sentiment_counts = {};
    if (counts) counts.forEach(r => sentiment_counts[r.sentiment || 'Neutral'] = parseInt(r.count, 10));

    const { data: comments } = await supabase
      .from('comments')
      .select('id, comment_text, stakeholder_type, sentiment, confidence, draft_sections(section_code)')
      .eq('draft_id', id)
      .order('id', { ascending: true })
      .limit(200);

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
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
