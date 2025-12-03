import React, { useState } from 'react';
import './ResultsDisplay.css';

export function ResultsDisplay({ report, onDownloadPDF, onSendEmail }) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendEmail = async () => {
    if (!recipients.trim()) {
      alert('Please enter at least one email recipient');
      return;
    }

    setIsSending(true);
    try {
      await onSendEmail(recipients.split(',').map((r) => r.trim()));
      alert('Email sent successfully!');
      setShowEmailForm(false);
      setRecipients('');
    } catch (error) {
      alert(`Failed to send email: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const getRecommendationColor = (level) => {
    switch (level) {
      case 'Highly Recommended':
        return 'success';
      case 'Recommended':
        return 'info';
      case 'Consider':
        return 'warning';
      case 'Not Recommended':
        return 'danger';
      default:
        return 'info';
    }
  };

  if (!report) {
    return <div className="results-display">No report available</div>;
  }

  // Defensive defaults for fields that may be nested or missing
  const candidateInfo = report.candidateInfo || { name: 'Candidate', position: '', interviewDate: new Date().toISOString() };
  const perf = report.performanceMetrics || { averageScore: 0, communicationRating: 0, technicalRating: 0, confidenceLevel: '' };
  const introductionHighlights = report.introductionHighlights || [];
  const topStrengths = report.topStrengths || report.strengthsAndWeaknesses?.topStrengths || [];
  const areasForImprovement = report.areasForImprovement || report.strengthsAndWeaknesses?.areasForImprovement || [];
  const hiringRecommendation = report.hiringRecommendation || { level: '', reasoning: '', nextSteps: '' };

  return (
    <div className="results-display">
      <div className="results-header">
        <h1>Interview Results</h1>
        <p>Comprehensive evaluation for {candidateInfo.name}</p>
      </div>

      <div className="candidate-info">
        <div className="info-item">
          <label>Candidate Name</label>
          <span>{candidateInfo.name}</span>
        </div>
        <div className="info-item">
          <label>Position</label>
          <span>{candidateInfo.position}</span>
        </div>
        <div className="info-item">
          <label>Interview Date</label>
          <span>{new Date(candidateInfo.interviewDate).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <label>Average Score</label>
          <div className="metric-value">{Number.isFinite(Number(perf.averageScore)) ? Number(perf.averageScore).toFixed(1) + '/100' : 'N/A'}</div>
          <div className="metric-bar">
            <div
              className="metric-fill"
              style={{ width: `${Number.isFinite(Number(perf.averageScore)) ? Number(perf.averageScore) : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="metric-card">
          <label>Communication Rating</label>
          <div className="metric-value">{perf.communicationRating}/5</div>
        </div>

        <div className="metric-card">
          <label>Technical Rating</label>
          <div className="metric-value">{perf.technicalRating}/5</div>
        </div>

        <div className="metric-card">
          <label>Confidence Level</label>
          <div className="metric-value">{perf.confidenceLevel}</div>
        </div>
      </div>

      <div className="sections-container">
        <section className="results-section">
          <h2>Introduction Highlights</h2>
          <ul className="highlights-list">
            {introductionHighlights.map((highlight, idx) => (
              <li key={idx}>{highlight}</li>
            ))}
          </ul>
        </section>

        <section className="results-section">
          <h2>Top Strengths</h2>
          <ul className="strengths-list">
            {topStrengths.map((strength, idx) => (
              <li key={idx}>✓ {strength}</li>
            ))}
          </ul>
        </section>

        <section className="results-section">
          <h2>Areas for Improvement</h2>
          <ul className="improvements-list">
            {areasForImprovement.map((area, idx) => (
              <li key={idx}>→ {area}</li>
            ))}
          </ul>
        </section>

        <section className="results-section">
          <h2>Hiring Recommendation</h2>
            <div className={`recommendation-box ${getRecommendationColor(hiringRecommendation.level)}`}>
            <div className="recommendation-level">{hiringRecommendation.level}</div>
            <p>{hiringRecommendation.reasoning}</p>
            <div className="next-steps">
              <strong>Next Steps:</strong> {hiringRecommendation.nextSteps}
            </div>
          </div>
        </section>
      </div>

      <div className="actions-container">
        <button className="btn btn-primary" onClick={onDownloadPDF}>
          📥 Download PDF or Txt Report
        </button>
        <button className="btn btn-secondary" onClick={() => setShowEmailForm(!showEmailForm)}>
          📧 Send Email Report
        </button>
      </div>

      {showEmailForm && (
        <div className="email-form">
          <h3>Send Report via Email</h3>
          <input
            type="text"
            placeholder="Enter email addresses (comma-separated)"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            className="email-input"
          />
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSendEmail} disabled={isSending}>
              {isSending ? 'Sending...' : 'Send Email'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowEmailForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
