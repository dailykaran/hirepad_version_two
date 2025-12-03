import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testQuestionGeneration() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const introduction = 'I have 5 years of experience in software development with expertise in React and Node.js';
    
    const prompt = `You are a professional HR recruiter. Respond in English. Return the questions in English and ensure the JSON fields are in English. Based on the following candidate's self-introduction, generate exactly 7 diverse and relevant follow-up interview questions in English.

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

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      },
    });
    
    const responseText = result.response.text();
    
    console.log('\n📊 Raw Response:');
    console.log('Length:', responseText.length);
    console.log('---START---');
    console.log(responseText);
    console.log('---END---');
    
    // Try to parse with code fence extraction
    const codeFenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeFenceMatch) {
      console.log('\n✅ Found code fence');
      const jsonContent = codeFenceMatch[1].trim();
      console.log('Content in fence (first 200 chars):', jsonContent.substring(0, 200));
      try {
        const parsed = JSON.parse(jsonContent);
        console.log('\n✅ Successfully parsed JSON');
        console.log('Questions count:', Array.isArray(parsed) ? parsed.length : 'Not an array');
        console.log('First question:', Array.isArray(parsed) ? parsed[0] : 'N/A');
      } catch (e) {
        console.log('\n❌ Failed to parse JSON from fence:', e.message);
      }
    } else {
      console.log('\n❌ No code fence found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testQuestionGeneration().then(() => process.exit(0));
