import { sendInterviewReportEmail } from './src/backend/services/mcpEmailService.js';
import dotenv from 'dotenv';

dotenv.config();

const testSession = {
  summaryReport: {
    candidateInfo: {
      name: "Test Candidate",
      position: "Senior Developer",
      interviewDate: new Date().toISOString(),
      duration: 1200
    },
    introductionHighlights: [
      "Demonstrated strong technical background",
      "Clear communication skills",
      "Enthusiasm for the role"
    ],
    performanceMetrics: {
      averageScore: 85,
      communicationRating: 4,
      technicalRating: 4,
      confidenceLevel: "High"
    },
    strengthsAndWeaknesses: {
      topStrengths: ["Strong problem solving", "Clear communication", "Technical expertise"],
      areasForImprovement: ["Time management", "Documentation"]
    },
    hiringRecommendation: {
      level: "Highly Recommended",
      reasoning: "Excellent fit for role with demonstrated skills",
      nextSteps: "Schedule final interview"
    },
    reportGeneratedAt: new Date().toISOString()
  },
  questions: [
    {
      questionNumber: 1,
      questionText: "Tell us about your experience",
      answer: {
        transcription: "I have 5 years of experience in software development...",
        duration: 30
      },
      evaluation: {
        score: 85,
        feedback: "Good response",
        strengths: ["Clear articulation"],
        improvements: ["More examples"]
      }
    }
  ]
};

(async () => {
  try {
    console.log('📧 Testing Gmail email delivery...');
    console.log('Using email provider:', process.env.EMAIL_PROVIDER);
    console.log('Gmail Client ID:', process.env.GMAIL_CLIENT_ID?.substring(0, 20) + '...');
    console.log('Refresh Token:', process.env.GMAIL_REFRESH_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('');
    
    const result = await sendInterviewReportEmail(
      testSession, 
      [process.env.HR_EMAIL_RECIPIENTS || 'your-email@gmail.com']
    );
    console.log('✅ Email sent successfully:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('unauthorized_client')) {
      console.error('\n⚠️  Refresh token is invalid or expired!');
      console.error('\nTo fix this, run:');
      console.error('  node get-gmail-refresh-token.js');
      console.error('\nThis will generate a new refresh token.');
    }
    
    console.error('\nFull error:', error);
  }
  process.exit(0);
})();
