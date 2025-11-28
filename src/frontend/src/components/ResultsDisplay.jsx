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

  return (
    <div className="results-display">
      <div className="results-header">
        <h1>Interview Results</h1>
        <p>Comprehensive evaluation for {report.candidateInfo.name}</p>
      </div>

      <div className="candidate-info">
        <div className="info-item">
          <label>Candidate Name</label>
          <span>{report.candidateInfo.name}</span>
        </div>
        <div className="info-item">
          <label>Position</label>
          <span>{report.candidateInfo.position}</span>
        </div>
        <div className="info-item">
          <label>Interview Date</label>
          <span>{new Date(report.candidateInfo.interviewDate).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <label>Average Score</label>
          <div className="metric-value">{report.performanceMetrics.averageScore.toFixed(1)}/100</div>
          <div className="metric-bar">
            <div
              className="metric-fill"
              style={{ width: `${report.performanceMetrics.averageScore}%` }}
            ></div>
          </div>
        </div>

        <div className="metric-card">
          <label>Communication Rating</label>
          <div className="metric-value">{report.performanceMetrics.communicationRating}/5</div>
        </div>

        <div className="metric-card">
          <label>Technical Rating</label>
          <div className="metric-value">{report.performanceMetrics.technicalRating}/5</div>
        </div>

        <div className="metric-card">
          <label>Confidence Level</label>
          <div className="metric-value">{report.performanceMetrics.confidenceLevel}</div>
        </div>
      </div>

      <div className="sections-container">
        <section className="results-section">
          <h2>Introduction Highlights</h2>
          <ul className="highlights-list">
            {report.introductionHighlights.map((highlight, idx) => (
              <li key={idx}>{highlight}</li>
            ))}
          </ul>
        </section>

        <section className="results-section">
          <h2>Top Strengths</h2>
          <ul className="strengths-list">
            {report.topStrengths.map((strength, idx) => (
              <li key={idx}>✓ {strength}</li>
            ))}
          </ul>
        </section>

        <section className="results-section">
          <h2>Areas for Improvement</h2>
          <ul className="improvements-list">
            {report.areasForImprovement.map((area, idx) => (
              <li key={idx}>→ {area}</li>
            ))}
          </ul>
        </section>

        <section className="results-section">
          <h2>Hiring Recommendation</h2>
          <div className={`recommendation-box ${getRecommendationColor(report.hiringRecommendation.level)}`}>
            <div className="recommendation-level">{report.hiringRecommendation.level}</div>
            <p>{report.hiringRecommendation.reasoning}</p>
            <div className="next-steps">
              <strong>Next Steps:</strong> {report.hiringRecommendation.nextSteps}
            </div>
          </div>
        </section>
      </div>

      <div className="actions-container">
        <button className="btn btn-primary" onClick={onDownloadPDF}>
          📥 Download PDF Report
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
