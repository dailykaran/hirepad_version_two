import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Copy of the improved parsing functions from geminiService.js
function parseJsonFromText(text, openChar = '{', closeChar = '}') {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  
  try {
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return JSON.parse(trimmed);
    }
  } catch (e) {
    // fallthrough
  }

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeFenceMatch && codeFenceMatch[1]) {
    try {
      return JSON.parse(codeFenceMatch[1].trim());
    } catch (e) {
      // continue
    }
  }

  const withoutFences = trimmed
    .replace(/```(?:json|javascript|js)?\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  const textToScan = withoutFences !== trimmed ? withoutFences : trimmed;
  const firstStart = textToScan.indexOf(openChar);
  
  if (firstStart !== -1) {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let i = firstStart; i < textToScan.length; i++) {
      const ch = textToScan[i];
      
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
          const candidate = textToScan.slice(firstStart, i + 1);
          const parsed = tryParseJson(candidate);
          if (parsed !== null) return parsed;
          break;
        }
      }
    }
  }

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

function tryParseJson(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;

  try {
    return JSON.parse(candidate);
  } catch (e) {
    try {
      let fixed = candidate
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/['']/g, '"')
        .replace(/[""]/g, '"')
        .replace(/:\s*'/g, ': "')
        .replace(/,\s*'/g, ', "')
        .replace(/\[\s*'/g, '[ "')
        .replace(/([^\\])'\s*([,}\]])/g, '$1"$2')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/:\s*,/g, ': null,')
        .replace(/:\s*([}\]])/g, ': null$1')
        .replace(/}\s*,\s*}/g, '}')
        .replace(/]\s*,\s*]/g, ']')
        .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
        .replace(/:\s*"([^"]*)\n([^"]*)"/g, (match, p1, p2) => {
          return ': "' + p1.trim() + ' ' + p2.trim() + '"';
        })
        .replace(/\s+/g, ' ');
      
      return JSON.parse(fixed);
    } catch (e2) {
      const result = {};
      
      const scoreMatch = candidate.match(/"score"\s*:\s*(\d+)|score\s*:\s*(\d+)/);
      if (scoreMatch) {
        result.score = parseInt(scoreMatch[1] || scoreMatch[2], 10);
      }
      
      const feedbackMatch = candidate.match(/"feedback"\s*:\s*"([^"]*)"|feedback\s*:\s*"([^"]*)"/);
      if (feedbackMatch) {
        result.feedback = feedbackMatch[1] || feedbackMatch[2];
      }
      
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
      
      if (result.score !== undefined || result.feedback) {
        return result;
      }
      
      return null;
    }
  }
}

async function testQuestionGeneration() {
  console.log('\n=== Testing Question Generation ===\n');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not set');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const intro = "I'm a software engineer with 5 years of experience in TypeScript and React development.";
  
  const prompt = `You are a professional HR recruiter. Generate exactly 7 diverse and relevant follow-up interview questions in English.

Self-Introduction: "${intro}"

Generate 7 interview questions that cover different competency areas.

Return ONLY a valid JSON array with exactly 7 questions. No markdown, no code fences, no extra text. Example:
["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?", "Question 6?", "Question 7?"]`;

  try {
    console.log('📤 Sending question generation request to Gemini...\n');
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2000,
      },
    });

    const responseText = result.response.text();
    console.log(`📥 Response received (length: ${responseText.length} chars)`);
    console.log(`\n📝 Raw response:\n${responseText}\n`);

    const parsed = parseJsonFromText(responseText, '[', ']');
    
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      console.log(`✅ SUCCESS: Parsed ${parsed.length} questions`);
      parsed.slice(0, 3).forEach((q, i) => {
        console.log(`   Q${i + 1}: ${q}`);
      });
      console.log('   ...\n');
    } else {
      console.log(`❌ FAILED: Could not parse questions as array`);
      console.log(`   Parsed result type: ${typeof parsed}`);
      console.log(`   Is array: ${Array.isArray(parsed)}`);
      if (parsed) console.log(`   Parsed: ${JSON.stringify(parsed).substring(0, 200)}\n`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function testAnswerEvaluation() {
  console.log('\n=== Testing Answer Evaluation ===\n');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not set');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const question = "Tell us about your most significant professional achievement.";
  const answer = "I led a team of 5 engineers to redesign our payment processing system, reducing transaction time by 40% and improving reliability to 99.99% uptime.";
  
  const prompt = `You are a professional HR recruiter. Evaluate this candidate's answer objectively.

Question: "${question}"
Answer: "${answer}"

Score this answer from 0-100 and provide structured feedback.

Respond with ONLY a valid JSON object on a single line. No markdown, no code fences, no extra text, no line breaks:
{"score": <0-100 integer>, "feedback": "<1-2 sentence summary>", "strengths": ["<strength 1>", "<strength 2>"], "improvements": ["<improvement 1>", "<improvement 2>"]}`;

  try {
    console.log('📤 Sending evaluation request to Gemini...\n');
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1500,
      },
    });

    const responseText = result.response.text();
    console.log(`📥 Response received (length: ${responseText.length} chars)`);
    console.log(`\n📝 Raw response:\n${responseText}\n`);

    const parsed = parseJsonFromText(responseText, '{', '}');
    
    if (parsed && typeof parsed === 'object' && parsed.score !== undefined) {
      console.log(`✅ SUCCESS: Parsed evaluation`);
      console.log(`   Score: ${parsed.score}/100`);
      console.log(`   Feedback: ${parsed.feedback}`);
      console.log(`   Strengths: ${Array.isArray(parsed.strengths) ? parsed.strengths.length + ' items' : 'N/A'}`);
      console.log(`   Improvements: ${Array.isArray(parsed.improvements) ? parsed.improvements.length + ' items' : 'N/A'}\n`);
    } else {
      console.log(`❌ FAILED: Could not parse evaluation as object`);
      console.log(`   Parsed result type: ${typeof parsed}`);
      if (parsed) console.log(`   Parsed: ${JSON.stringify(parsed).substring(0, 200)}\n`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('🧪 Testing Improved Parsing Functions');
  console.log('=====================================\n');
  
  await testQuestionGeneration();
  await testAnswerEvaluation();
  
  console.log('\n✅ Testing complete!\n');
}

main().catch(console.error);
