import React from 'react';
import { Pie } from 'react-chartjs-2';
import ReactWordcloud from 'react-wordcloud';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/scale.css';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';

// Register required Chart.js elements
Chart.register(ArcElement, Tooltip, Legend);


export default function Dashboard({ analysis }) {
  const counts = analysis.sentiment_counts || {};
  const labels = ['Positive', 'Neutral', 'Negative'];
  const data = {
    labels,
    datasets: [{ data: labels.map(l => counts[l] || 0) }]
  };

  // Word cloud source: prefer last_run.top_keywords then analysis.top_keywords
  const wordsSource = (analysis.last_run && analysis.last_run.top_keywords) || (analysis.top_keywords || []);
  const wordData = (Array.isArray(wordsSource) ? wordsSource : []).map(w => ({ text: w.word || w, value: w.count || w.value || 1 }));

  const sampleComments = (analysis.comments || []).slice(0, 10);

  const draftSummary = (analysis.last_run && analysis.last_run.draft_summary) || analysis.draft_summary || 'No summary available';

  return (
    <div>
      <h3>Executive Summary</h3>
      <p>{draftSummary}</p>

      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ width: 360, background: '#fff', padding: 12, borderRadius: 8 }}>
          <h4>Sentiment distribution</h4>
          <Pie data={data} />
        </div>

        <div style={{ flex: 1, background: '#fff', padding: 12, borderRadius: 8 }}>
          <h4>Word Cloud</h4>
          <div style={{ height: 300 }}>
            <ReactWordcloud words={wordData} />
          </div>
        </div>
      </div>

      <h4 style={{ marginTop: 18 }}>Top comments (sample)</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 6 }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={{ padding: 8 }}>ID</th>
            <th>Stakeholder</th>
            <th>Sentiment</th>
            <th>Confidence</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          {sampleComments.map(c => (
            <tr key={c.id}>
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
