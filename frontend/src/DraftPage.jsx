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
    <div style={{ padding: 20, borderRadius: 8, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ color: '#003366', marginBottom: 12 }}>{draft.title}</h2>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleAnalyze}
          disabled={running}
          style={{
            padding: '10px 18px',
            borderRadius: 6,
            border: 'none',
            background: '#0059b3',
            color: '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#004080'}
          onMouseLeave={e => e.currentTarget.style.background = '#0059b3'}
        >
          {running ? 'Analyzing...' : 'Analyze'}
        </button>
        {error && <span style={{ marginLeft: 12, color: 'red' }}>{error}</span>}
      </div>

      {analysis && <Dashboard analysis={analysis} />}
    </div>
  );
}
