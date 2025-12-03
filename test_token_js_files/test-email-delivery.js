/**
 * Test script for nodemailer MCP email delivery
 * Run: node test-email-delivery.js
 */

const sessionId = process.argv[2] || 'session_test_123';

// Mock session data with summary report
const mockSession = {
  candidateId: sessionId,
  timestamp: new Date().toISOString(),
  selfIntroduction: {
    transcription: 'I am John Smith with 8 years of software engineering experience.',
    duration: 30,
  },
  questions: [
    {
      questionNumber: 1,
      questionText: 'Tell us about your most challenging project',
      answer: { transcription: 'I led a migration from monolith to microservices' },
      evaluation: { score: 85, feedback: 'Excellent technical depth' },
    },
    {
      questionNumber: 2,
      questionText: 'How do you handle team conflicts?',
      answer: { transcription: 'I prefer open communication and collaborative solutions' },
      evaluation: { score: 80, feedback: 'Good interpersonal skills' },
    },
  ],
  summaryReport: {
    candidateInfo: {
      name: 'John Smith',
      position: 'Senior Developer',
      interviewDate: new Date().toISOString(),
      duration: 1800,
    },
    performanceMetrics: {
      averageScore: 82.5,
      communicationRating: 4,
      technicalRating: 4.5,
      confidenceLevel: 'High',
    },
    strengthsAndWeaknesses: {
      topStrengths: [
        'Strong technical foundation',
        'Excellent problem-solving skills',
        'Good communication',
      ],
      areasForImprovement: [
        'Leadership experience',
        'Public speaking confidence',
      ],
    },
    hiringRecommendation: {
      level: 'RECOMMENDED',
      reasoning:
        'Candidate demonstrates strong technical skills and team collaboration abilities. Exceeds requirements.',
      nextSteps: 'Schedule final round interview with hiring manager',
    },
  },
};

// Test the email sending
async function testEmailDelivery() {
  try {
    console.log('🧪 Testing Nodemailer MCP Email Delivery\n');
    console.log(`📧 Session ID: ${sessionId}`);
    console.log(`👤 Candidate: ${mockSession.summaryReport.candidateInfo.name}`);
    console.log(`💼 Position: ${mockSession.summaryReport.candidateInfo.position}\n`);

    // Import the email service
    const { sendInterviewReportEmail } = await import(
      '../src/backend/services/mcpEmailService.js'
    );

    const recipients = process.env.HR_EMAIL_RECIPIENTS || 'dinakaran83@gmail.com';

    console.log(`📤 Sending email to: ${recipients}`);
    console.log('⏳ Processing...\n');

    // Send the email
    const result = await sendInterviewReportEmail(mockSession, recipients);

    console.log('\n✅ Email delivery test completed!');
    console.log(result);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Email delivery test failed:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testEmailDelivery();
