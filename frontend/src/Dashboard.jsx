import React from 'react';
import { Pie } from 'react-chartjs-2';
import ReactWordcloud from 'react-wordcloud';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/scale.css';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';

Chart.register(ArcElement, Tooltip, Legend);

export default function Dashboard({ analysis }) {
  const counts = analysis.sentiment_counts || {};
  const labels = ['Positive', 'Neutral', 'Negative'];
  const data = {
    labels,
    datasets: [{ data: labels.map(l => counts[l] || 0), backgroundColor: ['#2ca02c', '#ffcc00', '#d62728'] }]
  };

  const wordsSource = (analysis.last_run && analysis.last_run.top_keywords) || (analysis.top_keywords || []);
  const wordData = (Array.isArray(wordsSource) ? wordsSource : []).map(w => ({ text: w.word || w, value: w.count || w.value || 1 }));

  const sampleComments = (analysis.comments || []).slice(0, 10);
  const draftSummary = (analysis.last_run && analysis.last_run.draft_summary) || analysis.draft_summary || 'No summary available';

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ color: '#003366' }}>Executive Summary</h3>
      <p style={{ lineHeight: 1.6 }}>{draftSummary}</p>

      <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
        <div style={{ width: 360, background: '#f9f9f9', padding: 16, borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.1)' }}>
          <h4 style={{ color: '#003366' }}>Sentiment Distribution</h4>
          <Pie data={data} />
        </div>

        <div style={{ flex: 1, background: '#f9f9f9', padding: 16, borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.1)' }}>
          <h4 style={{ color: '#003366' }}>Word Cloud</h4>
          <div style={{ height: 300 }}>
            <ReactWordcloud words={wordData} />
          </div>
        </div>
      </div>

      <h4 style={{ marginTop: 20, color: '#003366' }}>Top Comments (Sample)</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 6, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.1)' }}>
        <thead style={{ background: '#e6f2ff', color: '#003366' }}>
          <tr>
            <th style={{ padding: 10 }}>ID</th>
            <th>Stakeholder</th>
            <th>Sentiment</th>
            <th>Confidence</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          {sampleComments.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid #ddd', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f0f8ff'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <td style={{ padding: 8 }}>{c.id}</td>
              <td>{c.stakeholder_type}</td>
              <td>{c.sentiment}</td>
              <td>{c.confidence}</td>
              <td>{c.comment_text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
