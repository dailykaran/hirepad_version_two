import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testMaxTokens() {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const introduction = 'I have 5 years of experience in software development with expertise in React and Node.js';
  
  const prompt = `Generate 7 interview questions as a JSON array.
Introduction: "${introduction}"
Return: ["Q1?", "Q2?", ...]`;

  const tokenLimits = [50, 100, 200, 300, 400, 500, 600, 800, 1000, 2000];

  for (const maxTokens of tokenLimits) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      });
      
      const responseText = result.response.text();
      console.log(`maxOutputTokens=${maxTokens}: ${responseText.length > 0 ? '✅ ' + responseText.length : '❌ EMPTY'}`);
    } catch (error) {
      console.log(`maxOutputTokens=${maxTokens}: ERROR - ${error.message}`);
    }
  }
}

testMaxTokens().then(() => process.exit(0));
