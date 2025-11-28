import React from 'react';
import './QuestionDisplay.css';

export function QuestionDisplay({
  question,
  questionNumber,
  totalQuestions,
  transcription,
  isLoading = false,
}) {
  return (
    <div className="question-display">
      <div className="question-header">
        <div className="question-number">
          Question {questionNumber} of {totalQuestions}
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="question-content">
        <h2>{question}</h2>
      </div>

      {transcription && (
        <div className="transcription-box">
          <h3>Your Response (Live Transcription)</h3>
          <p className={isLoading ? 'loading' : ''}>{transcription}</p>
        </div>
      )}
    </div>
  );
}
