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

// Helper: try to extract JSON (object or array) from arbitrary model text
function parseJsonFromText(text, openChar = '{', closeChar = '}') {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  
  // 1) Try direct JSON.parse on trimmed text
  try {
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return JSON.parse(trimmed);
    }
  } catch (e) {
    // fallthrough
  }

  // 2) Try to find a fenced code block with ```json or ```
  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeFenceMatch && codeFenceMatch[1]) {
    try {
      return JSON.parse(codeFenceMatch[1].trim());
    } catch (e) {
      // continue to next strategy
    }
  }

  // 3) Remove all markdown code fences first (including ones on separate lines)
  const withoutFences = trimmed
    .replace(/```(?:json|javascript|js)?\s*/gi, '')  // Remove opening fences with language
    .replace(/```\s*/gi, '')                          // Remove closing fences
    .trim();                                          // Re-trim after removal

  // 4) Find the first balanced JSON structure by scanning for the first openChar and matching depth
  // This correctly handles escaped characters and newlines
  const textToScan = withoutFences !== trimmed ? withoutFences : trimmed;
  const firstStart = textToScan.indexOf(openChar);
  
  if (firstStart !== -1) {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let i = firstStart; i < textToScan.length; i++) {
      const ch = textToScan[i];
      
      // Handle escape sequences within strings
      if (inString && escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (ch === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      
      // Toggle string state on unescaped quotes
      if (ch === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      // Only count brackets when not inside a string
      if (!inString) {
        if (ch === openChar) depth++;
        else if (ch === closeChar) depth--;

        if (depth === 0) {
          const candidate = textToScan.slice(firstStart, i + 1);
          const parsed = tryParseJson(candidate);
          if (parsed !== null) return parsed;
          break;
        }
      }
    }
  }

  // 5) Try scanning all bracket spans (fallback)
  for (let s = 0; s < textToScan.length; s++) {
    if (textToScan[s] !== openChar) continue;
    
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let j = s; j < textToScan.length; j++) {
      const ch = textToScan[j];
      
      if (inString && escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (ch === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      
      if (ch === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (ch === openChar) depth++;
        else if (ch === closeChar) depth--;
        
        if (depth === 0) {
          const candidate = textToScan.slice(s, j + 1);
          const parsed = tryParseJson(candidate);
          if (parsed !== null) return parsed;
          break;
        }
      }
    }
  }

  return null;
}

// Lightweight JSON normalization and safe parse with field-level recovery
function tryParseJson(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;

  // First try direct parse
  try {
    return JSON.parse(candidate);
  } catch (e) {
    // Attempt aggressive normalization fixes
    try {
      let fixed = candidate
        // Handle various quote types
        .replace(/[\u2018\u2019]/g, "'")      // Replace smart single quotes
        .replace(/[\u201C\u201D]/g, '"')      // Replace smart double quotes
        .replace(/['']/g, '"')                // Replace curved quotes with straight quotes
        .replace(/[""]/g, '"')                // Replace fancy quotes with straight quotes
        
        // Fix common JSON issues
        .replace(/:\s*'/g, ': "')             // : ' → : "
        .replace(/,\s*'/g, ', "')             // , ' → , "
        .replace(/\[\s*'/g, '[ "')            // [ ' → [ "
        .replace(/([^\\])'\s*([,}\]])/g, '$1"$2')  // Fix single quotes at end of values
        .replace(/,\s*([}\]])/g, '$1')        // Remove trailing commas before } or ]
        .replace(/:\s*,/g, ': null,')         // Replace empty values with null
        .replace(/:\s*([}\]])/g, ': null$1')  // Replace missing values with null
        .replace(/}\s*,\s*}/g, '}')           // Remove comma between objects
        .replace(/]\s*,\s*]/g, ']')           // Remove comma between arrays
        
        // Fix unquoted keys
        .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
        
        // Handle newlines and whitespace in strings
        .replace(/:\s*"([^"]*)\n([^"]*)"/g, (match, p1, p2) => {
          return ': "' + p1.trim() + ' ' + p2.trim() + '"';
        })
        
        // Normalize whitespace
        .replace(/\s+/g, ' ');
      
      return JSON.parse(fixed);
    } catch (e2) {
      // Field-level extraction as ultimate fallback
      // This handles severely malformed JSON by extracting individual fields
      
      const result = {};
      
      // For evaluation objects, try to extract score, feedback, strengths, improvements
      const scoreMatch = candidate.match(/"score"\s*:\s*(\d+)|score\s*:\s*(\d+)/);
      if (scoreMatch) {
        result.score = parseInt(scoreMatch[1] || scoreMatch[2], 10);
      }
      
      const feedbackMatch = candidate.match(/"feedback"\s*:\s*"([^"]*)"|feedback\s*:\s*"([^"]*)"/);
      if (feedbackMatch) {
        result.feedback = feedbackMatch[1] || feedbackMatch[2];
      }
      
      // Extract strengths array
      const strengthsMatch = candidate.match(/"strengths"\s*:\s*\[([\s\S]*?)\]|strengths\s*:\s*\[([\s\S]*?)\]/);
      if (strengthsMatch) {
        const strengthsText = strengthsMatch[1] || strengthsMatch[2];
        const strengths = strengthsText
          .split(',')
          .map(s => s.trim().replace(/^["']|["']$/g, ''))
          .filter(s => s.length > 0);
        result.strengths = strengths;
      } else {
        result.strengths = [];
      }
      
      // Extract improvements array
      const improvementsMatch = candidate.match(/"improvements"\s*:\s*\[([\s\S]*?)\]|improvements\s*:\s*\[([\s\S]*?)\]/);
      if (improvementsMatch) {
        const improvementsText = improvementsMatch[1] || improvementsMatch[2];
        const improvements = improvementsText
          .split(',')
          .map(s => s.trim().replace(/^["']|["']$/g, ''))
          .filter(s => s.length > 0);
        result.improvements = improvements;
      } else {
        result.improvements = [];
      }
      
      // For question arrays, try to extract individual question strings
      if (candidate.includes('[') && !candidate.includes('score')) {
        const questionsMatch = candidate.match(/\[([\s\S]*)\]/);
        if (questionsMatch) {
          const questionsText = questionsMatch[1];
          const questions = questionsText
            .split(/"\s*,\s*"/)
            .map(q => q.trim().replace(/^["']|["']$/g, ''))
            .filter(q => q.length > 0);
          if (questions.length > 0) {
            return questions;
          }
        }
      }
      
      // If we extracted any fields, return the partial object
      if (result.score !== undefined || result.feedback) {
        return result;
      }
      
      return null;
    }
  }
}

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
  const questionCount = candidateSession.questions.length || 0;
  const totalScore = questionCount > 0 ? candidateSession.questions.reduce((sum, q) => sum + (Number(q.evaluation && q.evaluation.score) || 0), 0) : 0;
  const avgScore = questionCount > 0 ? totalScore / questionCount : 0;
  
  return {
    introductionHighlights: [
      'Demonstrated strong professional background',
      'Clear understanding of role requirements',
      'Enthusiastic about the opportunity',
    ],
    performanceMetrics: {
      averageScore: Number.isFinite(avgScore) ? Math.round(avgScore) : 0,
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
export async function generateInterviewQuestions(introduction, language = 'en-US') {
  try {
    // Get Gemini client (lazy initialization)
    const client = getGeminiClient();

    // Use mock responses if Gemini not configured
    if (!client) {
      console.log('Using mock questions for development');
      return generateMockQuestions(introduction);
    }

    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Determine language instruction and explicit output language guidance
    const languageInstruction = language === 'ta-IN'
      ? {
          name: 'Tamil',
          note: 'Respond ONLY in Tamil (தமிழ்). Return the questions in Tamil script and ensure the JSON fields are in Tamil.'
        }
      : language === 'hi-IN'
      ? {
          name: 'Hindi',
          note: 'Respond ONLY in Hindi (हिन्दी). Return the questions in Hindi (Devanagari) and ensure the JSON fields are in Hindi.'
        }
      : {
          name: 'English',
          note: 'Respond in English. Return the questions in English and ensure the JSON fields are in English.'
        };

    const prompt = `You are a professional HR recruiter. ${languageInstruction.note} Based on the following candidate's self-introduction, generate exactly 7 diverse and relevant follow-up interview questions in ${languageInstruction.name}.

Self-Introduction: "${introduction}"

Generate 7 interview questions that cover different competency areas such as:
- Technical skills (if applicable)
- Problem-solving abilities
- Communication skills
- Team collaboration
- Experience and background
- Career goals and motivation
- Specific domain expertise

Return ONLY a valid JSON array with exactly 7 questions. No markdown, no code fences, no extra text. Example:
["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?", "Question 6?", "Question 7?"]`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2000,
      },
    });
    const responseText = result.response.text();
    
    console.log(`✅ Gemini API questions response received (length: ${responseText.length})`);
    if (responseText.length > 0) {
      console.log(`📝 First 150 chars: "${responseText.substring(0, 150)}"`);
    }

    // Parse JSON from response robustly
    const questionsJson = parseJsonFromText(responseText, '[', ']');
    if (!questionsJson || !Array.isArray(questionsJson) || questionsJson.length === 0) {
      console.warn('❌ Could not parse questions from Gemini response, using mock');
      console.warn('Response text length:', responseText?.length || 0);
      console.warn('Response preview:', responseText ? responseText.substring(0, 200) : 'EMPTY');
      return generateMockQuestions(introduction);
    }

    console.log(`✅ Successfully parsed ${questionsJson.length} questions from Gemini`);
    return questionsJson.slice(0, 7); // Ensure exactly 7 questions
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
export async function evaluateAnswer(question, answer, language = 'en-US') {
  try {
    // Get Gemini client (lazy initialization)
    const client = getGeminiClient();

    // Use mock responses if Gemini not configured
    if (!client) {
      console.log('Using mock evaluation for development');
      return generateMockEvaluation();
    }

    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const languageNote = language === 'ta-IN'
      ? 'The candidate responded in Tamil (தமிழ்). Provide the evaluation in Tamil and include language-appropriate feedback.'
      : language === 'hi-IN'
      ? 'The candidate responded in Hindi (हिन्दी). Provide the evaluation in Hindi and include language-appropriate feedback.'
      : 'The candidate responded in English. Provide the evaluation in English.';

    const prompt = `You are a professional HR recruiter. Evaluate this candidate's answer objectively.

Question: "${question}"
Answer: "${answer}"

Score this answer from 0-100 and provide structured feedback.

Respond with ONLY a valid JSON object on a single line. No markdown, no code fences, no extra text, no line breaks:
{"score": <0-100 integer>, "feedback": "<1-2 sentence summary>", "strengths": ["<strength 1>", "<strength 2>"], "improvements": ["<improvement 1>", "<improvement 2>"]}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1500,
      },
    });

    // Check if response was blocked or had issues
    if (result.response.candidates && result.response.candidates.length > 0) {
      const candidate = result.response.candidates[0];
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.warn(`⚠️  Gemini response finished with reason: ${candidate.finishReason}`);
      }
    }

    const responseText = result.response.text();
    console.log(`📊 Evaluation response length: ${responseText.length}`);
    if (responseText.length > 0) {
      console.log(`📝 First 150 chars: "${responseText.substring(0, 150)}"`);
      console.log(`📝 Last 150 chars: "${responseText.substring(Math.max(0, responseText.length - 150))}"`);
    } else {
      console.log('⚠️  Response is EMPTY');
    }

    // Parse JSON from response robustly
    const evalJson = parseJsonFromText(responseText, '{', '}');
    if (!evalJson) {
      console.warn('❌ Could not parse evaluation from Gemini response, using mock');
      console.warn('Full response:', responseText);
      return generateMockEvaluation();
    }

    console.log(`✅ Successfully parsed evaluation from Gemini (score: ${evalJson.score})`);
    return evalJson;
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
export async function generateSummaryReport(candidateSession, language = 'en-US') {
  try {
    // Get Gemini client (lazy initialization)
    const client = getGeminiClient();

    // Use mock responses if Gemini not configured
    if (!client) {
      console.log('Using mock report for development');
      return generateMockReport(candidateSession);
    }

    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const evaluations = candidateSession.questions.map((q, idx) => ({
      question: q.questionText,
      answer: q.answer.transcription,
      score: q.evaluation.score,
      feedback: q.evaluation.feedback,
    }));

    const languageNote = language === 'ta-IN'
      ? 'Note: The interview was conducted in Tamil (தமிழ்). Return the report fields (highlights, strengths, feedback) in Tamil.'
      : language === 'hi-IN'
      ? 'Note: The interview was conducted in Hindi (हिन्दी). Return the report fields in Hindi.'
      : '';

    const prompt = `You are a senior HR recruiter generating a comprehensive interview summary report.

Candidate Information:
- Name: ${candidateSession.summaryReport.candidateInfo.name}
- Position: ${candidateSession.summaryReport.candidateInfo.position}
- Self-Introduction: ${candidateSession.selfIntroduction.transcription}

${languageNote}

Interview Q&A Evaluations:
${evaluations.map((e, i) => `Q${i + 1}: ${e.question}\nA: ${e.answer}\nScore: ${e.score}/100 - ${e.feedback}`).join('\n\n')}

Generate a comprehensive JSON report on a single line. Respond with ONLY valid JSON, no markdown, no code fences, no extra text:
{"introductionHighlights": ["<key highlight 1>", "<highlight 2>", "<highlight 3>"], "performanceMetrics": {"averageScore": <number>, "communicationRating": <1-5>, "technicalRating": <1-5>, "confidenceLevel": "<High|Medium|Low>"}, "topStrengths": ["<strength 1>", "<strength 2>", "<strength 3>"], "areasForImprovement": ["<area 1>", "<area 2>"], "hiringRecommendation": {"level": "<Highly Recommended|Recommended|Consider|Not Recommended>", "reasoning": "<detailed reasoning>", "nextSteps": "<recommended next action>"}}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 3000,
      },
    });

    const responseText = result.response.text();
    console.log(`✅ Gemini API report response received (length: ${responseText.length})`);
    if (responseText.length > 0) {
      console.log(`📝 Report response preview: "${responseText.substring(0, 200)}"`);
    }

    // Parse JSON from response robustly
    const reportJson = parseJsonFromText(responseText, '{', '}');
    if (!reportJson) {
      console.warn('❌ Could not parse report from Gemini response, using mock');
      console.warn('Response text length:', responseText?.length || 0);
      return generateMockReport(candidateSession);
    }

    console.log(`✅ Successfully parsed report from Gemini`);
    return reportJson;
  } catch (error) {
    console.error('Error generating summary report:', error.message);
    console.log('Falling back to mock report');
    // Fallback to mock report if API fails
    return generateMockReport(candidateSession);
  }
}
