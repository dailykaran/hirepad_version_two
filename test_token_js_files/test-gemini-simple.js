import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
console.log(`Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testSimplePrompt() {
  try {
    console.log('\n📝 Testing simple Gemini prompt...');
    console.log(`Model: gemini-2.5-flash`);
    console.log(`API Key present: ${process.env.GEMINI_API_KEY ? '✅ Yes' : '❌ No'}`);
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = 'Return the array [1, 2, 3]';
    console.log(`\nPrompt: "${prompt}"`);
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    
    console.log(`\n📊 Response Object:`, {
      status: response.candidates?.[0]?.finishReason || 'unknown',
      candidatesCount: response.candidates?.length || 0
    });
    
    const text = response.text();
    console.log(`Response text length: ${text.length}`);
    console.log(`Response text: ${text || 'EMPTY'}`);
    
    if (text) {
      console.log('\n✅ API returned content!');
      return true;
    } else {
      console.log('\n❌ API returned empty response');
      console.log('Full response object:', JSON.stringify(response, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

testSimplePrompt().then(success => {
  if (success) {
    console.log('\n✅ Gemini API is working correctly');
  } else {
    console.log('\n⚠️ Gemini API returned empty response - possible quota/model issue');
  }
  process.exit(0);
});
