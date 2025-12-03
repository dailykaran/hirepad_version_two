import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

import { generateInterviewQuestions } from '../src/backend/services/geminiService.js';

async function testQuestionGeneration() {
  console.log('📝 Testing question generation from Gemini...\n');

  const testIntroduction = 'My name is John Smith. I have 5 years of experience in software development, primarily with JavaScript and React. I am passionate about building scalable web applications and have led several projects from conception to deployment.';

  try {
    const questions = await generateInterviewQuestions(testIntroduction, 'en-US');
    
    console.log('✅ Questions generated successfully:');
    console.log(JSON.stringify(questions, null, 2));
    
    if (questions && Array.isArray(questions) && questions.length === 7) {
      console.log('\n✅ Question generation PASSED - got 7 questions');
    } else {
      console.log('\n⚠️  WARNING: Not exactly 7 questions or not an array');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testQuestionGeneration();
