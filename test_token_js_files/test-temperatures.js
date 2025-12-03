import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testTemperatures() {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = 'Return exactly this array: [1, 2, 3]';
  const temps = [0, 0.3, 0.5, 0.7, 0.9, 1.0];
  
  for (const temp of temps) {
    try {
      console.log(`\nTesting temperature: ${temp}`);
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: temp,
          maxOutputTokens: 500,
        },
      });
      const text = result.response.text();
      console.log(`  Response length: ${text.length}`);
      console.log(`  Content: ${text ? text.substring(0, 100) : 'EMPTY'}`);
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
    }
  }
}

testTemperatures().then(() => process.exit(0));
