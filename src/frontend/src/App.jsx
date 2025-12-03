import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { RecordingComponent } from './components/RecordingComponent';
import { QuestionDisplay } from './components/QuestionDisplay';
import { ResultsDisplay } from './components/ResultsDisplay';
import { useAPI } from './hooks/useAudioRecorder';
import { formatScore } from './utils/formatters';
import './App.css';

function App() {
  const [appState, setAppState] = useState('welcome'); // welcome, intro, interview, results
  const [sessionID, setSessionID] = useState(null);
  const [candidateInfo, setCandidateInfo] = useState({ name: '', position: '' });
  const [language, setLanguage] = useState('en-US'); // en-US, ta-IN (Tamil), hi-IN (Hindi)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [transcriptions, setTranscriptions] = useState({});
  const [evaluations, setEvaluations] = useState({});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [introTranscription, setIntroTranscription] = useState('');

  const { makeRequest, uploadAudio } = useAPI();

  const initializeSession = async () => {
    setLoading(true);
    try {
      const response = await makeRequest('POST', '/api/session/init', candidateInfo);
      setSessionID(response.sessionID);
      setAppState('intro');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIntroductionComplete = async (recordingData) => {
    setLoading(true);
    try {
      const response = await uploadAudio(
        `/api/upload-audio/introduction/${sessionID}`,
        recordingData.blob,
        recordingData.duration,
        language,
      );

      setIntroTranscription(response.transcription);

      // Wait a moment for UI to update before generating questions
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Generate questions
      const questionsResponse = await makeRequest(
        'POST',
        `/api/generate-questions/${sessionID}`,
        {},
      );

      setQuestions(questionsResponse.questions);
      setCurrentQuestionIndex(0);
      setAppState('interview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerComplete = async (recordingData) => {
    setLoading(true);
    try {
      // Upload answer
      const uploadResponse = await uploadAudio(
        `/api/upload-audio/answer/${sessionID}/${currentQuestionIndex + 1}`,
        recordingData.blob,
        recordingData.duration,
        language,
      );

      setTranscriptions({
        ...transcriptions,
        [currentQuestionIndex]: uploadResponse.transcription,
      });

      // Evaluate answer
      const evaluationResponse = await makeRequest(
        'POST',
        `/api/evaluate/${sessionID}/${currentQuestionIndex + 1}`,
        {},
      );

      setEvaluations({
        ...evaluations,
        [currentQuestionIndex]: evaluationResponse.evaluation,
      });

      // Move to next question or generate report
      if (currentQuestionIndex + 1 < questions.length) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        // Generate report
        const reportResponse = await makeRequest('POST', `/api/generate-report/${sessionID}`, {});
        setReport(reportResponse.report);
        setAppState('results');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!report) {
      alert('No report available to download');
      return;
    }

    try {
      if (language === 'ta-IN') {
        // Generate text summary in frontend (same format as backend text)
        const lines = [];
        lines.push('Interview Summary Report');
        lines.push(`Candidate: ${report.candidateInfo.name || 'N/A'}`);
        lines.push(`Position: ${report.candidateInfo.position || 'N/A'}`);
        lines.push('');
        const metrics = report.performanceMetrics || {};
        lines.push('Performance Metrics:');
        lines.push(`  Average Score: ${metrics.averageScore ?? 'N/A'}`);
        lines.push(`  Communication Rating: ${metrics.communicationRating ?? 'N/A'}`);
        lines.push(`  Technical Rating: ${metrics.technicalRating ?? 'N/A'}`);
        lines.push(`  Confidence Level: ${metrics.confidenceLevel ?? 'N/A'}`);
        lines.push('');
        lines.push('Top Strengths:');
        (report.topStrengths || []).forEach(s => lines.push(`  - ${s}`));
        lines.push('');
        lines.push('Areas For Improvement:');
        (report.areasForImprovement || []).forEach(a => lines.push(`  - ${a}`));
        lines.push('');
        lines.push('Questions & Answers:');
        (questions || []).forEach((q, idx) => {
          lines.push(`Q${idx + 1}: ${q}`);
          lines.push(`A: ${transcriptions[idx] || 'No answer recorded'}`);
          const ev = evaluations[idx] || {};
          if (ev.score) lines.push(`Score: ${ev.score}/100`);
          if (ev.feedback) lines.push(`Feedback: ${ev.feedback}`);
          lines.push('');
        });
        lines.push('Hiring Recommendation:');
        if (report.hiringRecommendation) {
          lines.push(`  Level: ${report.hiringRecommendation.level}`);
          lines.push(`  Reasoning: ${report.hiringRecommendation.reasoning}`);
          lines.push(`  Next Steps: ${report.hiringRecommendation.nextSteps}`);
        }

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const fileName = `interview_report_${report.candidateInfo.name.replace(/\s+/g, '_')}_${Date.now()}.txt`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
        return;
      }

      // Existing PDF generation code for non-Tamil languages
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      // Helper function to add text with word wrapping
      const addText = (text, fontSize = 11, isBold = false, isCenter = false) => {
        doc.setFontSize(fontSize);
        doc.setFont(undefined, isBold ? 'bold' : 'normal');
        const lines = doc.splitTextToSize(text, maxWidth);
        
        lines.forEach((line) => {
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          
          if (isCenter) {
            doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
          } else {
            doc.text(line, margin, yPosition);
          }
          yPosition += 7;
        });
      };

      // Helper to format duration
      const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
          return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
      };

      // Title
      addText('AI HR Interview Report', 18, true, true);
      yPosition += 5;

      // Candidate Info
      addText('Candidate Information', 13, true);
      addText(`Name: ${report.candidateInfo.name}`, 11);
      addText(`Position: ${report.candidateInfo.position}`, 11);
      addText(`Interview Date: ${new Date(report.candidateInfo.interviewDate).toLocaleDateString()}`, 11);
      yPosition += 5;

      // Performance Metrics
      addText('Performance Metrics', 13, true);
      addText(`Average Score: ${report.performanceMetrics.averageScore.toFixed(1)}/100`, 11);
      addText(`Communication Rating: ${report.performanceMetrics.communicationRating}/5`, 11);
      addText(`Technical Rating: ${report.performanceMetrics.technicalRating}/5`, 11);
      addText(`Confidence Level: ${report.performanceMetrics.confidenceLevel}`, 11);
      yPosition += 5;

      // Introduction Highlights
      if (report.introductionHighlights && report.introductionHighlights.length > 0) {
        addText('Introduction Highlights', 13, true);
        report.introductionHighlights.forEach((highlight) => {
          addText(`• ${highlight}`, 10);
        });
        yPosition += 3;
      }

      // Top Strengths
      if (report.topStrengths && report.topStrengths.length > 0) {
        addText('Top Strengths', 13, true);
        report.topStrengths.forEach((strength) => {
          addText(`✓ ${strength}`, 10);
        });
        yPosition += 3;
      }

      // Areas for Improvement
      if (report.areasForImprovement && report.areasForImprovement.length > 0) {
        addText('Areas for Improvement', 13, true);
        report.areasForImprovement.forEach((area) => {
          addText(`→ ${area}`, 10);
        });
        yPosition += 3;
      }

      // Questions & Answers Section
      if (questions && questions.length > 0) {
        yPosition += 3;
        addText('Interview Questions & Answers', 13, true);
        
        questions.forEach((question, index) => {
          const evaluation = evaluations[index] || {};
          const duration = evaluations[index]?.duration || 0;
          
          // Question
          addText(`Q${index + 1}: ${question}`, 11, true);
          
          // Answer with duration
          const answerText = transcriptions[index] || 'No answer recorded';
          const durationStr = formatDuration(duration);
          addText(`Answer (${durationStr}):`, 10, true);
          addText(answerText, 10);
          
          // Score and feedback
          if (evaluation.score) {
            addText(`Score: ${evaluation.score}/100`, 10, true);
          }
          if (evaluation.feedback) {
            addText(`Feedback: ${evaluation.feedback}`, 10);
          }
          
          yPosition += 3;
        });
      }

      // Hiring Recommendation
      if (report.hiringRecommendation) {
        yPosition += 3;
        addText('Hiring Recommendation', 13, true);
        addText(`Level: ${report.hiringRecommendation.level}`, 11, true);
        addText(`Reasoning: ${report.hiringRecommendation.reasoning}`, 11);
        addText(`Next Steps: ${report.hiringRecommendation.nextSteps}`, 11);
      }

      // Footer with timestamp
      doc.setFontSize(9);
      doc.setFont(undefined, 'italic');
      doc.text(
        `Generated on ${new Date().toLocaleString()}`,
        pageWidth / 2,
        pageHeight - margin + 5,
        { align: 'center' }
      );

      // Save PDF
      const fileName = `interview_report_${report.candidateInfo.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      doc.save(fileName);
    } catch (error) {
      setError(`Failed to generate download: ${error.message}`);
      console.error('Download error:', error);
    }
  };

  const handleSendEmail = async (recipients) => {
    setLoading(true);
    try {
      await makeRequest('POST', `/api/send-report/${sessionID}`, { recipients });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetApp = () => {
    setAppState('welcome');
    setSessionID(null);
    setCandidateInfo({ name: '', position: '' });
    setLanguage('en-US');
    setCurrentQuestionIndex(0);
    setQuestions([]);
    setTranscriptions({});
    setEvaluations({});
    setReport(null);
    setError(null);
    setIntroTranscription('');
  };

  return (
    <div className="app">
      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="header-content">
            <h1 className="app-title">🎤 AI HR Interviewer</h1>
            <p className="app-subtitle">Automated Audio Interview System</p>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Main Content */}
        <main className="app-content">
          {appState === 'welcome' && (
            <section className="welcome-section">
              <div className="welcome-card">
                <h2>Welcome to AI HR Interview</h2>
                <p>
                  Complete a comprehensive audio interview to be evaluated by our AI system. The
                  process takes approximately 15-20 minutes.
                </p>

                <div className="form-group">
                  <label>Your Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={candidateInfo.name}
                    onChange={(e) => setCandidateInfo({ ...candidateInfo, name: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Position Applied For</label>
                  <input
                    type="text"
                    placeholder="Enter position"
                    value={candidateInfo.position}
                    onChange={(e) =>
                      setCandidateInfo({ ...candidateInfo, position: e.target.value })
                    }
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Interview Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={loading}
                  >
                      <option value="en-US">English (US)</option>
                      <option value="ta-IN">Tamil (India)</option>
                  </select>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={initializeSession}
                  disabled={!candidateInfo.name || !candidateInfo.position || loading}
                >
                  {loading ? 'Initializing...' : 'Start Interview'}
                </button>
              </div>
            </section>
          )}

          {appState === 'intro' && (
            <section className="intro-section">
              <div className="intro-card">
                <h2>Self-Introduction</h2>
                <p>
                  Please record a 2-3 minute self-introduction. Tell us about yourself, your
                  background, and why you're interested in this position.
                </p>

                <RecordingComponent 
                  onRecordingComplete={handleIntroductionComplete}
                  transcription={introTranscription}
                  isLoading={loading}
                />

                {loading && (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Generating interview questions...</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {appState === 'interview' && (
            <section className="interview-section">
              {questions.length > 0 && (
                <div className="interview-card">
                  <QuestionDisplay
                    question={questions[currentQuestionIndex]}
                    questionNumber={currentQuestionIndex + 1}
                    totalQuestions={questions.length}
                    transcription={transcriptions[currentQuestionIndex] || ''}
                    isLoading={loading}
                  />

                  <RecordingComponent
                    questionNumber={currentQuestionIndex + 1}
                    onRecordingComplete={handleAnswerComplete}
                    transcription={transcriptions[currentQuestionIndex] || ''}
                    isLoading={loading}
                  />

                  {evaluations[currentQuestionIndex] && (
                    <div className="evaluation-summary">
                      <h3>Answer Evaluation</h3>
                      <div className="score-badge">
                        Score: {formatScore(evaluations[currentQuestionIndex].score)}/100
                      </div>
                      <p>{evaluations[currentQuestionIndex].feedback}</p>
                    </div>
                  )}

                  {loading && (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <p>Processing your answer...</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {appState === 'results' && (
            <section className="results-section">
              {report ? (
                <>
                  <ResultsDisplay
                    report={report}
                    onDownloadPDF={handleDownloadPDF}
                    onSendEmail={handleSendEmail}
                  />

                  <div className="results-actions">
                    <button className="btn btn-primary" onClick={resetApp}>
                      Start New Interview
                    </button>
                  </div>
                </>
              ) : (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Generating comprehensive report...</p>
                </div>
              )}
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <p>© 2025 AI HR Interviewer. Powered by Google Gemini and Speech-to-Text.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
