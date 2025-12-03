import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import { evaluateAnswer } from '../services/geminiService.js';

async function testEvaluation() {
  console.log('\n📝 Testing evaluation with real candidate answer...\n');

  const question = "Describe a situation where you had to solve a complex problem. What was your approach?";
  const answer = "Yes, I got question from now Gemini. Now, front end... Yeah, my specific role is here. My role on this.";
  const language = 'en-US';

  try {
    const evaluation = await evaluateAnswer(question, answer, language);
    
    console.log('\n✅ Evaluation Result:');
    console.log(JSON.stringify(evaluation, null, 2));
    
    if (evaluation.score) {
      console.log('\n✅ Successfully got a real evaluation (not mock)!');
    } else {
      console.log('\n⚠️ Got mock evaluation');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testEvaluation();
