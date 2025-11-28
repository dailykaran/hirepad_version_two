import express from 'express';
import { transcribeAudio } from '../services/speechService.js';
import { generateInterviewQuestions, evaluateAnswer, generateSummaryReport } from '../services/geminiService.js';
import { sendInterviewReportEmail, initializeMCPClient, closeMCPClient } from '../services/mcpEmailService.js';

const router = express.Router();

// In-memory storage for sessions (replace with database in production)
const sessions = {};

/**
 * Initialize a new interview session
 * POST /api/session/init
 */
router.post('/session/init', (req, res) => {
  const sessionID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  sessions[sessionID] = {
    candidateId: sessionID,
    timestamp: new Date().toISOString(),
    selfIntroduction: {
      audioUrl: '',
      transcription: '',
      duration: 0,
    },
    questions: [],
    overallAssessment: {
      totalScore: 0,
      summary: '',
      recommendation: '',
    },
    summaryReport: {
      candidateInfo: {
        name: req.body.name || 'Candidate',
        position: req.body.position || 'Position Not Specified',
        interviewDate: new Date().toISOString(),
        duration: 0,
      },
      introductionHighlights: [],
      performanceMetrics: {
        averageScore: 0,
        communicationRating: 0,
        technicalRating: 0,
        confidenceLevel: '',
      },
      strengthsAndWeaknesses: {
        topStrengths: [],
        areasForImprovement: [],
      },
      hiringRecommendation: {
        level: '',
        reasoning: '',
        nextSteps: '',
      },
      reportGeneratedAt: new Date().toISOString(),
    },
  };

  res.status(201).json({
    sessionID,
    message: 'Session initialized',
  });
});

/**
 * Upload and transcribe self-introduction audio
 * POST /api/upload-audio/introduction/:sessionID
 */
router.post('/upload-audio/introduction/:sessionID', async (req, res) => {
  try {
    const { sessionID } = req.params;
    const session = sessions[sessionID];

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!req.files || !req.files.audio) {
      return res.status(400).json({ error: 'Audio file required' });
    }

    const audioFile = req.files.audio;
    
    // Log file info for debugging
    console.log(`Transcribing introduction for session ${sessionID}`);
    console.log(`File size: ${audioFile.size} bytes, MIME type: ${audioFile.mimetype}`);

    const transcription = await transcribeAudio(audioFile.data);

    session.selfIntroduction.transcription = transcription;
    session.selfIntroduction.audioUrl = `/audio/introduction/${sessionID}`;
    session.selfIntroduction.duration = req.body.duration || 0;

    res.json({
      transcription,
      message: 'Introduction transcribed successfully',
    });
  } catch (error) {
    console.error('Error in upload-audio/introduction:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Generate interview questions based on introduction
 * POST /api/generate-questions/:sessionID
 */
router.post('/generate-questions/:sessionID', async (req, res) => {
  try {
    const { sessionID } = req.params;
    const session = sessions[sessionID];

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.selfIntroduction.transcription) {
      return res.status(400).json({ error: 'Introduction transcription required' });
    }

    const questions = await generateInterviewQuestions(session.selfIntroduction.transcription);

    // Initialize question objects
    session.questions = questions.map((questionText, index) => ({
      questionNumber: index + 1,
      questionText,
      answer: {
        audioUrl: '',
        transcription: '',
        duration: 0,
      },
      evaluation: {
        score: 0,
        feedback: '',
        strengths: [],
        improvements: [],
      },
    }));

    res.json({
      questions,
      message: 'Questions generated successfully',
    });
  } catch (error) {
    console.error('Error in generate-questions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Upload and transcribe answer audio
 * POST /api/upload-audio/answer/:sessionID/:questionNumber
 */
router.post('/upload-audio/answer/:sessionID/:questionNumber', async (req, res) => {
  try {
    const { sessionID, questionNumber } = req.params;
    const session = sessions[sessionID];

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!req.files || !req.files.audio) {
      return res.status(400).json({ error: 'Audio file required' });
    }

    const qNum = parseInt(questionNumber, 10) - 1;
    if (qNum < 0 || qNum >= session.questions.length) {
      return res.status(400).json({ error: 'Invalid question number' });
    }

    const audioFile = req.files.audio;
    
    // Log file info for debugging
    console.log(`Transcribing answer ${qNum + 1} for session ${sessionID}`);
    console.log(`File size: ${audioFile.size} bytes, MIME type: ${audioFile.mimetype}`);

    const transcription = await transcribeAudio(audioFile.data);

    session.questions[qNum].answer.transcription = transcription;
    session.questions[qNum].answer.audioUrl = `/audio/answer/${sessionID}/${questionNumber}`;
    session.questions[qNum].answer.duration = req.body.duration || 0;

    res.json({
      transcription,
      message: 'Answer transcribed successfully',
    });
  } catch (error) {
    console.error('Error in upload-audio/answer:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Evaluate a single answer
 * POST /api/evaluate/:sessionID/:questionNumber
 */
router.post('/evaluate/:sessionID/:questionNumber', async (req, res) => {
  try {
    const { sessionID, questionNumber } = req.params;
    const session = sessions[sessionID];

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const qNum = parseInt(questionNumber, 10) - 1;
    if (qNum < 0 || qNum >= session.questions.length) {
      return res.status(400).json({ error: 'Invalid question number' });
    }

    const question = session.questions[qNum].questionText;
    const answer = session.questions[qNum].answer.transcription;

    if (!answer) {
      return res.status(400).json({ error: 'Answer transcription required' });
    }

    const evaluation = await evaluateAnswer(question, answer);
    session.questions[qNum].evaluation = evaluation;

    res.json({
      evaluation,
      message: 'Answer evaluated successfully',
    });
  } catch (error) {
    console.error('Error in evaluate:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate comprehensive summary report
 * POST /api/generate-report/:sessionID
 */
router.post('/generate-report/:sessionID', async (req, res) => {
  try {
    const { sessionID } = req.params;
    const session = sessions[sessionID];

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Calculate average score
    const scores = session.questions.map((q) => q.evaluation.score);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Generate comprehensive report
    const reportData = await generateSummaryReport(session);

    // Update session with report
    session.summaryReport.introductionHighlights = reportData.introductionHighlights;
    session.summaryReport.performanceMetrics = reportData.performanceMetrics;
    session.summaryReport.topStrengths = reportData.topStrengths;
    session.summaryReport.areasForImprovement = reportData.areasForImprovement;
    session.summaryReport.hiringRecommendation = reportData.hiringRecommendation;
    session.summaryReport.reportGeneratedAt = new Date().toISOString();

    // Calculate summary metrics if not provided by Gemini
    if (session.summaryReport.performanceMetrics.averageScore === 0) {
      session.summaryReport.performanceMetrics.averageScore = averageScore;
    }

    res.json({
      report: session.summaryReport,
      message: 'Report generated successfully',
    });
  } catch (error) {
    console.error('Error in generate-report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send report via email
 * POST /api/send-report/:sessionID
 */
router.post('/send-report/:sessionID', async (req, res) => {
  try {
    const { sessionID } = req.params;
    const { recipients } = req.body;

    const session = sessions[sessionID];
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients required' });
    }

    try {
      const emailResult = await sendInterviewReportEmail(session, recipients);

      res.json({
        message: 'Report sent successfully',
        result: emailResult,
      });
    } catch (emailError) {
      // Return error but don't fail - report was generated successfully
      console.warn('Email delivery failed but report was generated:', emailError.message);
      res.status(200).json({
        message: 'Report generated but email delivery failed',
        report: session.summaryReport,
        emailError: emailError.message,
      });
    }
  } catch (error) {
    console.error('Error in send-report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get session status
 * GET /api/session/:sessionID
 */
router.get('/session/:sessionID', (req, res) => {
  const { sessionID } = req.params;
  const session = sessions[sessionID];

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    sessionID,
    session,
  });
});

/**
 * Delete session
 * DELETE /api/session/:sessionID
 */
router.delete('/session/:sessionID', (req, res) => {
  const { sessionID } = req.params;

  if (!sessions[sessionID]) {
    return res.status(404).json({ error: 'Session not found' });
  }

  delete sessions[sessionID];
  res.json({ message: 'Session deleted' });
});

export default router;
