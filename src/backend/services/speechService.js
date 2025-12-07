import speech from '@google-cloud/speech';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file (for direct execution)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let speechClient = null;
let initAttempted = false;

// Initialize Speech-to-Text client with proper error handling
function initializeSpeechClient() {
  // Prevent multiple initialization attempts
  if (initAttempted) {
    return speechClient;
  }
  initAttempted = true;

  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!projectId) {
      console.warn('⚠️  GOOGLE_CLOUD_PROJECT_ID not configured. Speech-to-Text will use mock transcriptions.');
      return null;
    }

    if (!credentialsPath) {
      console.warn('⚠️  GOOGLE_APPLICATION_CREDENTIALS path not configured.');
      console.warn('   To enable Speech-to-Text:');
      console.warn('   1. Download service account JSON from Google Cloud Console');
      console.warn('   2. Set GOOGLE_APPLICATION_CREDENTIALS in .env');
      console.warn('   Speech-to-Text will use mock transcriptions.');
      return null;
    }

    // Check if credentials file exists
    if (!fs.existsSync(credentialsPath)) {
      console.warn(`⚠️  ❌ Credentials file NOT FOUND`);
      console.warn(`   Expected location: ${credentialsPath}`);
      console.warn(`   Real path checked: ${path.resolve(credentialsPath)}`);
      console.warn('   To fix:');
      console.warn('   1. Verify the file exists at that location');
      console.warn('   2. Or use relative path: GOOGLE_APPLICATION_CREDENTIALS=./credentials.json');
      console.warn('   Speech-to-Text will use mock transcriptions.');
      return null;
    }

    // Try to initialize the client
    const client = new speech.SpeechClient({
      projectId,
      keyFilename: credentialsPath,
    });

    console.log('✅ Speech-to-Text client initialized successfully');
    speechClient = client;
    return client;
  } catch (error) {
    console.warn('⚠️  Failed to initialize Speech-to-Text client:', error.message);
    console.warn('Speech-to-Text will use mock transcriptions.');
    return null;
  }
}

// Initialize client on first use (lazy initialization)
export function getSpeechClient() {
  if (!initAttempted) {
    initializeSpeechClient();
  }
  return speechClient;
}

/**
 * Validate audio buffer and check format
 */
function validateAudioBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Audio buffer is empty');
  }
  
  console.log(`📥 Audio buffer size: ${buffer.length} bytes`);
  
  // Check for WebM header (0x1A 0x45 0xDF 0xA3)
  const isWebM = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  
  // Check for WAV header (0x52 0x49 0x46 0x46 = "RIFF")
  const isWAV = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  
  // Check for MP3 header (0xFF 0xFB or 0xFF 0xFA)
  const isMP3 = (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa));
  
  const format = isWebM ? 'WebM' : isWAV ? 'WAV' : isMP3 ? 'MP3' : 'UNKNOWN';
  console.log(`📊 Audio format: ${format} (header: ${buffer.slice(0, 4).toString('hex').toUpperCase()})`);
  
  return { format, isWebM, isWAV, isMP3 };
}

/**
 * Extract audio duration from WebM header if possible
 */
function extractWebMDuration(buffer) {
  try {
    // WebM format is complex, return 0 to indicate we can't extract
    // The actual duration will come from frontend
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Estimate audio duration from buffer size and sample rate
 * @param {Buffer} audioBuffer - Audio data buffer
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {number} Estimated duration in seconds
 */
function estimateAudioDuration(audioBuffer, sampleRate = 48000) {
  // Rough estimation: for WEBM_OPUS, assume ~1 byte per ~100 samples
  // This is a heuristic; actual size depends on compression
  // For safety, assume higher compression ratio
  const bytesPerSecond = sampleRate / 100; // Very conservative estimate
  return audioBuffer.length / bytesPerSecond;
}

/**
 * Save audio buffer to local file system
 * @param {Buffer} audioBuffer - Audio data
 * @param {string} sessionID - Session identifier
 * @param {string} audioType - Type of audio (introduction, answer_N)
 * @returns {Promise<string>} Local file path relative to uploads directory
 */
export async function saveAudioLocally(audioBuffer, sessionID, audioType = 'audio') {
  try {
    const uploadsDir = path.resolve(path.dirname(__dirname), '../..', 'uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate filename: sessionID_audioType_timestamp.webm
    const fileName = `${sessionID}_${audioType}_${Date.now()}.webm`;
    const filePath = path.join(uploadsDir, fileName);

    // Write buffer to file
    await fs.promises.writeFile(filePath, audioBuffer);

    console.log(`💾 Audio saved locally: ${fileName}`);
    return `/uploads/${fileName}`; // Return relative path for frontend access
  } catch (error) {
    console.error('Error saving audio locally:', error.message);
    throw new Error(`Failed to save audio locally: ${error.message}`);
  }
}

/**
 * Transcribe audio file using Google Cloud Speech-to-Text API
 * Automatically uses sync for short audio and longRunningRecognize for longer audio
 * @param {Buffer} audioBuffer - Audio buffer (WebM, WAV, MP3, FLAC, etc.)
 * @param {string} encoding - Audio encoding (LINEAR16, FLAC, MULAW, AMR, AMR_WB, OGG_OPUS, MP3, WEBM_OPUS)
 * @param {string} sessionID - Session ID (optional, for logging only)
 * @param {string} languageCode - Language code (en-US, ta-IN, hi-IN, etc.)
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioBuffer, encoding = 'WEBM_OPUS', sessionID = null, languageCode = 'en-US') {
  try {
    // Check if buffer is empty
    if (!audioBuffer || audioBuffer.length === 0) {
      return 'No audio detected. Please try recording again.';
    }

    console.log(`\n🎙️  Starting transcription for session ${sessionID}...`);

    // Validate audio buffer format
    const formatInfo = validateAudioBuffer(audioBuffer);

    // Get the client (lazy initialization)
    const client = getSpeechClient();

    // If Speech-to-Text client not available, use mock transcription
    if (!client) {
      console.log('⚠️  Speech client unavailable, using mock');
      return getMockTranscription();
    }

    // Set appropriate sample rate based on encoding
    const sampleRateHertz = encoding === 'WEBM_OPUS' ? 48000 : 16000;

    // Estimate audio duration
    const estimatedDuration = estimateAudioDuration(audioBuffer, sampleRateHertz);
    console.log(`📈 Estimated audio duration: ${estimatedDuration.toFixed(1)}s`);
    console.log(`📊 Buffer size: ${audioBuffer.length} bytes, Format: ${formatInfo.format}`);
    console.log(`🌐 Language: ${languageCode}`);

    // Use inline transcription (sync for < 1min, async long-running for longer)
    return await transcribeAudioInline(audioBuffer, encoding, sampleRateHertz, client, formatInfo, languageCode);
  } catch (error) {
    console.error('❌ Error transcribing audio:', error.message);
    // Fallback to mock transcription for development
    console.log('⚠️  Falling back to mock transcription due to error');
    return getMockTranscription();
  }
}

/**
 * Transcribe inline audio (for files < 10MB and < 5 minutes)
 */
async function transcribeAudioInline(audioBuffer, encoding, sampleRateHertz, client, formatInfo, languageCode = 'en-US') {
  try {
    // Convert buffer to base64
    const audioContent = audioBuffer.toString('base64');

    const request = {
      audio: {
        content: audioContent,
      },
      config: {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
        enableAutomaticPunctuation: true,
        model: 'latest_long',
      },
    };

    // Try sync recognize first (for short audio < 1 min)
    try {
      console.log(`✅ Using SYNC transcription with encoding: ${encoding}`);
      console.log('📡 Calling Google Speech-to-Text API (sync)...');
      const [response] = await client.recognize(request);

      if (!response.results || response.results.length === 0) {
        console.log('⚠️  No transcription results');
        return 'No speech detected. Please try recording again.';
      }

      const transcription = response.results
        .map((result) => {
          if (!result.alternatives || result.alternatives.length === 0) {
            return '';
          }
          return result.alternatives[0].transcript;
        })
        .join(' ');

      const finalText = transcription || 'No speech detected. Please try recording again.';
      console.log(`✅ Sync transcription successful: "${finalText.substring(0, 50)}..."`);
      return finalText;
    } catch (syncError) {
      // If sync fails, use async long-running recognize
      if (
        syncError.message &&
        (syncError.message.includes('Sync input too long') ||
         syncError.message.includes('Inline audio exceeds duration limit') ||
         syncError.code === 3) // INVALID_ARGUMENT
      ) {
        console.log(`❌ Sync transcription failed: ${syncError.message}`);
        console.log('📢 Duration error in sync, trying async transcription...');
        
        const [operation] = await client.longRunningRecognize(request);
        console.log(`⏳ Async operation started: ${operation.name}`);
        console.log('⏳ Polling for results...');
        
        const [response] = await operation.promise();

        if (!response.results || response.results.length === 0) {
          console.log('⚠️  No transcription results');
          return 'No speech detected. Please try recording again.';
        }

        const transcription = response.results
          .map((result) => {
            if (!result.alternatives || result.alternatives.length === 0) {
              return '';
            }
            return result.alternatives[0].transcript;
          })
          .join(' ');

        const finalText = transcription || 'No speech detected. Please try recording again.';
        console.log(`✅ Async transcription successful: "${finalText.substring(0, 50)}..."`);
        return finalText;
      }
      
      // For other errors, throw
      throw syncError;
    }
  } catch (error) {
    console.error('❌ Error in inline transcription:', error.message);
    throw error;
  }
}

/**
 * Mock transcription for development/testing without Speech-to-Text API
 */
function getMockTranscription() {
  const mockResponses = [
    'Hello, my name is John Smith and I am excited about this opportunity.',
    'I have been working in software development for the past five years with a focus on full-stack applications.',
    'I believe my skills in React, Node.js, and cloud technologies would be valuable to your team.',
    'I am passionate about creating efficient and user-friendly solutions.',
    'This position aligns well with my career goals and interests.',
  ];
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

/**
 * Convert audio buffer to LINEAR16 format (commonly used by Google Speech-to-Text)
 * For MVP, assumes audio is already in compatible format
 */
export function convertAudioFormat(audioBuffer, targetEncoding = 'LINEAR16') {
  // In production, use ffmpeg.wasm or similar to convert audio formats
  // For MVP, assume incoming audio is already in LINEAR16 or compatible format
  return audioBuffer;
}

/**
 * Process audio file from disk
 */
export async function transcribeAudioFile(filePath) {
  try {
    const audioFile = fs.readFileSync(filePath);
    return await transcribeAudio(audioFile);
  } catch (error) {
    console.error('Error processing audio file:', error);
    throw new Error(`Failed to process audio file: ${error.message}`);
  }
}
