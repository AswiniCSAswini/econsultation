import fetch from 'node-fetch';
const API_URL = 'https://api.openai.com/v1/responses';
const KEY = process.env.OPENAI_API_KEY || '';


export async function callGemini(prompt, options = {}) {
if (!KEY) return mockGemini(prompt, options);
    const body = {
    model: options.model || 'gpt-5-mini',
    input: prompt,
    max_tokens: options.max_tokens || 400,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.0
    };


    const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${KEY}`
    },
    body: JSON.stringify(body)
    });


    const j = await resp.json();
    return j;
    }


// deterministic mock for offline testing
    function mockGemini(prompt, options) {
    // simple heuristics: if contains 'concern', 'too broad', 'unclear' etc -> Negative
    const text = (prompt || '').toLowerCase();
    let sentiment = 'Neutral';
    let confidence = 0.85;
    if (/too broad|overbroad|concern|danger|risk|problem|unclear|vague|oppose|against/.test(text)) {
    sentiment = 'Negative';
    confidence = 0.9;
    } else if (/support|welcome|positive|agree|benefit|improve|good|happy/.test(text)) {
    sentiment = 'Positive';
    confidence = 0.9;
    }


// overall summary mock: pick top phrases
    const response = {
    mock: true,
    output: {
    text: JSON.stringify({
    sentiment,
    confidence,
    draft_summary: 'Overall, the consultation received mixed feedback with concerns focused on definitions and clarity.',
    top_themes: ['Definitions','Clarity'],
    priority_recommendation: 'Clarify terms and narrow ambiguous definitions in key sections.'
    })
    }
    };
    return response;
    }