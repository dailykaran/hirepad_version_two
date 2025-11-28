import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let genAI = null;
let initAttempted = false;

// Initialize Gemini with error handling
function initializeGemini() {
  // Prevent multiple initialization attempts
  if (initAttempted) {
    return genAI;
  }
  initAttempted = true;

  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️  GEMINI_API_KEY not configured. Using mock responses for development.');
    return null;
  }
  
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini AI initialized successfully');
    return genAI;
  } catch (error) {
    console.warn('⚠️  Failed to initialize Gemini:', error.message);
    return null;
  }
}

// Lazy initialization function
export function getGeminiClient() {
  if (!initAttempted) {
    initializeGemini();
  }
  return genAI;
}

/**
 * Mock questions generator for development/testing
 */
function generateMockQuestions(introduction) {
  const mockQuestions = [
    'Can you tell us more about your most significant professional achievement?',
    'Describe a situation where you had to solve a complex problem. What was your approach?',
    'How do you stay updated with industry trends and technologies?',
    'Tell us about a time you had to work with a difficult team member. How did you handle it?',
    'What attracts you to this specific position and our organization?',
    'Describe your experience with leading projects or initiatives.',
    'Where do you see yourself in the next five years, and how does this role fit into that vision?',
  ];
  return mockQuestions;
}

/**
 * Mock evaluation generator for development/testing
 */
function generateMockEvaluation() {
  return {
    score: Math.floor(Math.random() * 30) + 70, // Random score 70-100
    feedback: 'Good response demonstrating relevant experience and communication skills.',
    strengths: [
      'Clear articulation of thoughts',
      'Relevant experience demonstrated',
      'Good communication skills',
    ],
    improvements: [
      'Could provide more specific examples',
      'Consider adding measurable outcomes',
    ],
  };
}

/**
 * Mock report generator for development/testing
 */
function generateMockReport(candidateSession) {
  const avgScore = candidateSession.questions.reduce((sum, q) => sum + q.evaluation.score, 0) / 
                  candidateSession.questions.length;
  
  return {
    introductionHighlights: [
      'Demonstrated strong professional background',
      'Clear understanding of role requirements',
      'Enthusiastic about the opportunity',
    ],
    performanceMetrics: {
      averageScore: Math.round(avgScore),
      communicationRating: 4,
      technicalRating: 4,
      confidenceLevel: 'High',
    },
    topStrengths: [
      'Excellent communication and presentation skills',
      'Strong relevant technical background',
      'Good problem-solving approach',
    ],
    areasForImprovement: [
      'More specific examples could strengthen responses',
      'Could elaborate on team collaboration experience',
    ],
    hiringRecommendation: {
      level: avgScore > 80 ? 'Highly Recommended' : 'Recommended',
      reasoning: 'Candidate demonstrates strong technical skills and communication abilities. Shows good fit for the role.',
      nextSteps: 'Schedule technical assessment and team lead interview.',
    },
  };
}

/**
 * Generate 7 interview questions based on candidate's self-introduction
 */
export async function generateInterviewQuestions(introduction) {
  try {
    // Get Gemini client (lazy initialization)
    const client = getGeminiClient();

    // Use mock responses if Gemini not configured
    if (!client) {
      console.log('Using mock questions for development');
      return generateMockQuestions(introduction);
    }

    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a professional HR recruiter. Based on the following candidate's self-introduction, generate exactly 7 diverse and relevant follow-up interview questions.

Self-Introduction: "${introduction}"

Generate 7 interview questions that cover different competency areas such as:
- Technical skills (if applicable)
- Problem-solving abilities
- Communication skills
- Team collaboration
- Experience and background
- Career goals and motivation
- Specific domain expertise

Return the response as a JSON array of 7 questions. Example format:
["Question 1?", "Question 2?", ...]`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 500,
      },
    });

    const responseText = result.response.text();

    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('Could not parse questions from Gemini response, using mock');
      return generateMockQuestions(introduction);
    }

    const questions = JSON.parse(jsonMatch[0]);
    return questions.slice(0, 7); // Ensure exactly 7 questions
  } catch (error) {
    console.error('Error generating interview questions:', error.message);
    console.log('Falling back to mock questions');
    // Fallback to mock questions if API fails
    return generateMockQuestions(introduction);
  }
}

/**
 * Evaluate a single answer using Gemini
 */
export async function evaluateAnswer(question, answer) {
  try {
    // Get Gemini client (lazy initialization)
    const client = getGeminiClient();

    // Use mock responses if Gemini not configured
    if (!client) {
      console.log('Using mock evaluation for development');
      return generateMockEvaluation();
    }

    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a professional HR recruiter evaluating candidate responses.

Question: "${question}"
Candidate's Answer: "${answer}"

Evaluate this answer based on:
- Relevance to the question
- Clarity and coherence
- Professional competency
- Communication skills
- Depth of understanding

Provide your evaluation as a JSON object with the following structure:
{
  "score": <number 0-100>,
  "feedback": "<brief constructive feedback>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"]
}`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 300,
      },
    });

    const responseText = result.response.text();

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Could not parse evaluation from Gemini response, using mock');
      return generateMockEvaluation();
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error evaluating answer:', error.message);
    console.log('Falling back to mock evaluation');
    // Fallback to mock evaluation if API fails
    return generateMockEvaluation();
  }
}

/**
 * Generate comprehensive interview summary report
 */
export async function generateSummaryReport(candidateSession) {
  try {
    // Get Gemini client (lazy initialization)
    const client = getGeminiClient();

    // Use mock responses if Gemini not configured
    if (!client) {
      console.log('Using mock report for development');
      return generateMockReport(candidateSession);
    }

    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const evaluations = candidateSession.questions.map((q, idx) => ({
      question: q.questionText,
      answer: q.answer.transcription,
      score: q.evaluation.score,
      feedback: q.evaluation.feedback,
    }));

    const prompt = `You are a senior HR recruiter generating a comprehensive interview summary report.

Candidate Information:
- Name: ${candidateSession.summaryReport.candidateInfo.name}
- Position: ${candidateSession.summaryReport.candidateInfo.position}
- Self-Introduction: ${candidateSession.selfIntroduction.transcription}

Interview Q&A Evaluations:
${evaluations.map((e, i) => `Q${i + 1}: ${e.question}\nA: ${e.answer}\nScore: ${e.score}/100 - ${e.feedback}`).join('\n\n')}

Generate a comprehensive JSON report including:
{
  "introductionHighlights": ["<key highlight 1>", "<highlight 2>", "<highlight 3>"],
  "performanceMetrics": {
    "averageScore": <number>,
    "communicationRating": <1-5>,
    "technicalRating": <1-5>,
    "confidenceLevel": "<High|Medium|Low>"
  },
  "topStrengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "areasForImprovement": ["<area 1>", "<area 2>"],
  "hiringRecommendation": {
    "level": "<Highly Recommended|Recommended|Consider|Not Recommended>",
    "reasoning": "<detailed reasoning>",
    "nextSteps": "<recommended next action>"
  }
}`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 800,
      },
    });

    const responseText = result.response.text();

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Could not parse report from Gemini response, using mock');
      return generateMockReport(candidateSession);
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating summary report:', error.message);
    console.log('Falling back to mock report');
    // Fallback to mock report if API fails
    return generateMockReport(candidateSession);
  }
}
