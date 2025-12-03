import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testActualPrompt() {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const introduction = 'I have 5 years of experience in software development with expertise in React and Node.js';
  
  const languageInstruction = {
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

Return the response as a JSON array of 7 questions, and ensure the array elements are written in the interview language. Example format:
["Question 1?", "Question 2?", ...]`;

  try {
    console.log('📝 Testing actual question generation prompt...');
    console.log('Prompt length:', prompt.length);
    console.log('\n--- First 300 chars of prompt ---');
    console.log(prompt.substring(0, 300));
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 500,
      },
    });
    
    const responseText = result.response.text();
    console.log('\n✅ Got response!');
    console.log('Response length:', responseText.length);
    console.log('Response text:\n', responseText);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testActualPrompt().then(() => process.exit(0));
