import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
console.log(`Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testWithGenerationConfig() {
  try {
    console.log('\n📝 Testing Gemini with generationConfig...');
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = 'Return the array [1, 2, 3]';
    console.log(`Prompt: "${prompt}"`);
    
    // Test 1: Simple call
    console.log('\n--- Test 1: Simple generateContent(prompt) ---');
    const result1 = await model.generateContent(prompt);
    const text1 = result1.response.text();
    console.log(`Response: ${text1 ? '✅ Got content' : '❌ Empty'}`);
    
    // Test 2: With generationConfig object
    console.log('\n--- Test 2: generateContent with generationConfig ---');
    const result2 = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });
    const text2 = result2.response.text();
    console.log(`Response: ${text2 ? '✅ Got content' : '❌ Empty'}`);
    
    // Test 3: Alternative config format
    console.log('\n--- Test 3: With separate config ---');
    const result3 = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const text3 = result3.response.text();
    console.log(`Response: ${text3 ? '✅ Got content' : '❌ Empty'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testWithGenerationConfig().then(() => process.exit(0));
