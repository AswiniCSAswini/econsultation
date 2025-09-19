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
    <div style={{ padding: 30, fontFamily: 'Arial, sans-serif', background: '#f5f7fa', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 20, color: '#003366' }}>eConsult — Sentiment Analysis</h1>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ width: 300 }}>
          <h3 style={{ marginBottom: 12, color: '#003366' }}>Drafts</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {drafts.map(d => (
              <li key={d.id} style={{ marginBottom: 10 }}>
                <button
                  onClick={() => setSelected(d)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid #ccc',
                    background: selected?.id === d.id ? '#e6f2ff' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f8ff'}
                  onMouseLeave={e => e.currentTarget.style.background = selected?.id === d.id ? '#e6f2ff' : '#fff'}
                >
                  <strong>{d.id}</strong> — {d.title}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 1 }}>
          {selected ? (
            <DraftPage draft={selected} />
          ) : (
            <div style={{ padding: 20, color: '#555', background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              Select a draft to analyze.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
