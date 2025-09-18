const BASE = process.env.REACT_APP_API || 'http://localhost:4000';
export async function fetchDrafts() { const r = await fetch(`${BASE}/api/drafts`); return r.json(); }
export async function analyzeDraft(id) { const r = await fetch(`${BASE}/api/analyze/${id}`, { method: 'POST' }); return r.json(); }
export async function fetchAnalysis(id) { const r = await fetch(`${BASE}/api/drafts/${id}/analysis`); return r.json(); }
