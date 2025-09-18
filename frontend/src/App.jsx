import React, { useEffect, useState } from 'react';
import { fetchDrafts } from './api';
import DraftPage from './DraftPage';

export default function App() {
  const [drafts, setDrafts] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchDrafts().then(setDrafts).catch(console.error);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>eConsult — Sentiment Analysis</h1>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ width: 300, background: '#fff', padding: 12, borderRadius: 8 }}>
          <h3>Drafts</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {drafts.map(d => (
              <li key={d.id} style={{ marginBottom: 8 }}>
                <button style={{ width: '100%', textAlign: 'left' }} onClick={() => setSelected(d)}>
                  <strong>{d.id}</strong> — {d.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: 1 }}>
          {selected ? <DraftPage draft={selected} /> : <div>Select a draft to analyze.</div>}
        </div>
      </div>
    </div>
  );
}
