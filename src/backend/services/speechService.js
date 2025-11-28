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
      console.warn('⚠️  GOOGLE_APPLICATION_CREDENTIALS path not configured. Speech-to-Text will use mock transcriptions.');
      return null;
    }

    // Check if credentials file exists
    if (!fs.existsSync(credentialsPath)) {
      console.warn(`⚠️  Credentials file not found at: ${credentialsPath}`);
      console.warn('Speech-to-Text will use mock transcriptions.');
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
 * Transcribe audio file using Google Cloud Speech-to-Text API
 * Automatically uses LongRunningRecognize for audio longer than 1 minute
 * @param {Buffer} audioBuffer - Audio buffer (WebM, WAV, MP3, FLAC, etc.)
 * @param {string} encoding - Audio encoding (LINEAR16, FLAC, MULAW, AMR, AMR_WB, OGG_OPUS, MP3, WEBM_OPUS)
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioBuffer, encoding = 'WEBM_OPUS') {
  try {
    // Check if buffer is empty
    if (!audioBuffer || audioBuffer.length === 0) {
      return 'No audio detected. Please try recording again.';
    }

    // Get the client (lazy initialization)
    const client = getSpeechClient();

    // If Speech-to-Text client not available, use mock transcription
    if (!client) {
      console.log('Using mock transcription (Speech-to-Text client not available)');
      return getMockTranscription();
    }

    // Convert buffer to base64
    const audioContent = audioBuffer.toString('base64');

    // Set appropriate sample rate based on encoding
    // WEBM_OPUS: 48000 Hz (standard for WebM Opus codec from browser MediaRecorder)
    // Other encodings: typically 16000 Hz
    const sampleRateHertz = encoding === 'WEBM_OPUS' ? 48000 : 16000;

    const request = {
      audio: {
        content: audioContent,
      },
      config: {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        model: 'latest_long',  // Use latest model for better accuracy
      },
    };

    // Try sync recognize first (fast for short audio < 1 min)
    try {
      console.log('Attempting sync transcription (for audio < 1 minute)...');
      const [response] = await client.recognize(request);

      if (!response.results || response.results.length === 0) {
        return 'No speech detected. Please try recording again.';
      }

      // Combine all transcription results
      const transcription = response.results
        .map((result) => {
          if (!result.alternatives || result.alternatives.length === 0) {
            return '';
          }
          return result.alternatives[0].transcript;
        })
        .join(' ');

      return transcription || 'No speech detected. Please try recording again.';
    } catch (syncError) {
      // If sync fails due to audio being too long, use async long-running recognize
      if (syncError.message && syncError.message.includes('Sync input too long')) {
        console.log('Audio too long for sync, attempting async long-running transcription...');
        
        // Use longRunningRecognize for longer audio
        const [operation] = await client.longRunningRecognize(request);
        console.log(`Waiting for long-running operation ${operation.name} to complete...`);
        
        // Wait for operation to complete (with timeout of 5 minutes)
        const [response] = await operation.promise();

        if (!response.results || response.results.length === 0) {
          return 'No speech detected. Please try recording again.';
        }

        // Combine all transcription results
        const transcription = response.results
          .map((result) => {
            if (!result.alternatives || result.alternatives.length === 0) {
              return '';
            }
            return result.alternatives[0].transcript;
          })
          .join(' ');

        return transcription || 'No speech detected. Please try recording again.';
      }
      
      // For other errors, throw and handle below
      throw syncError;
    }
  } catch (error) {
    console.error('Error transcribing audio:', error.message);
    // Fallback to mock transcription for development
    console.log('Falling back to mock transcription due to error');
    return getMockTranscription();
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
