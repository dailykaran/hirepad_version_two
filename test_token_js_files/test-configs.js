import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testDifferentConfigs() {
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

  const configs = [
    {
      name: 'Default (no config)',
      config: {},
    },
    {
      name: 'Only temperature',
      config: { temperature: 0.7 },
    },
    {
      name: 'Temperature + maxTokens',
      config: { temperature: 0.7, maxOutputTokens: 500 },
    },
    {
      name: 'With topK and topP',
      config: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 500 },
    },
    {
      name: 'Without topK/topP (simplified)',
      config: { temperature: 0.7, maxOutputTokens: 800 },
    },
  ];

  for (const { name, config } of configs) {
    try {
      console.log(`\n📝 Testing: ${name}`);
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: Object.keys(config).length > 0 ? config : undefined,
      });
      
      const responseText = result.response.text();
      console.log(`  Response length: ${responseText.length}`);
      if (responseText.length > 0) {
        console.log(`  ✅ GOT RESPONSE: ${responseText.substring(0, 100)}...`);
      } else {
        console.log(`  ❌ EMPTY RESPONSE`);
      }
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
    }
  }
}

testDifferentConfigs().then(() => process.exit(0));
