import React, { useState } from 'react';
import { analyzeDraft, fetchAnalysis } from './api';
import Dashboard from './Dashboard';

export default function DraftPage({ draft }) {
  const [running, setRunning] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  async function handleAnalyze() {
    setRunning(true);
    setError(null);
    try {
      await analyzeDraft(draft.id);
      const a = await fetchAnalysis(draft.id);
      setAnalysis(a);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Analysis failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ background: '#fff', padding: 14, borderRadius: 8 }}>
      <h2>{draft.title}</h2>
      <div style={{ marginBottom: 12 }}>
        <button onClick={handleAnalyze} disabled={running}>{running ? 'Analyzing...' : 'Analyze'}</button>
        <span style={{ marginLeft: 12 }}>{error && <span style={{ color: 'red' }}>{error}</span>}</span>
      </div>
      {analysis && <Dashboard analysis={analysis} />}
    </div>
  );
}
