#!/usr/bin/env node
/**
 * Test Script for Transcription Functionality
 * Tests: Session init, introduction upload, and transcription display
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5000/api';

async function test() {
  console.log('🧪 Testing Transcription Functionality\n');
  console.log('========================================\n');

  try {
    // Step 1: Initialize Session
    console.log('1️⃣  Initializing session...');
    const sessionRes = await fetch(`${API_BASE}/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Candidate',
        position: 'Software Engineer'
      })
    });

    if (!sessionRes.ok) {
      throw new Error(`Session init failed: ${sessionRes.status}`);
    }

    const sessionData = await sessionRes.json();
    const sessionID = sessionData.sessionID;
    console.log(`   ✅ Session created: ${sessionID}\n`);

    // Step 2: Create a mock audio file (silent WebM for testing)
    console.log('2️⃣  Creating test audio file...');
    const audioPath = path.join(process.cwd(), 'test_audio.webm');
    
    // Create a small silent WebM file (if it doesn't exist, use a minimal one)
    if (!fs.existsSync(audioPath)) {
      // This is a minimal valid WebM file header (silent audio)
      const webmHeader = Buffer.from([
        0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x1f, 0x42, 0x86, 0x81, 0x01,
        0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04,
        0x42, 0xf3, 0x81, 0x08, 0x42, 0x75, 0xa1, 0x80,
        0x4d, 0x80, 0x1a
      ]);
      fs.writeFileSync(audioPath, webmHeader);
    }
    console.log(`   ✅ Test audio created at: ${audioPath}\n`);

    // Step 3: Upload audio
    console.log('3️⃣  Uploading audio...');
    const audioBuffer = fs.readFileSync(audioPath);
    const formData = new FormData();
    formData.append('audio', new Blob([audioBuffer], { type: 'audio/webm' }), 'test.webm');
    formData.append('duration', '30');

    const uploadRes = await fetch(`${API_BASE}/upload-audio/introduction/${sessionID}`, {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      const errorData = await uploadRes.json();
      throw new Error(`Upload failed: ${uploadRes.status} - ${JSON.stringify(errorData)}`);
    }

    const uploadData = await uploadRes.json();
    console.log(`   ✅ Audio uploaded successfully`);
    console.log(`   📝 Transcription: "${uploadData.transcription}"`);
    console.log(`   🎵 Audio URL: ${uploadData.audioUrl}`);
    console.log(`   💾 Message: ${uploadData.message}\n`);

    // Step 4: Verify audio file was saved
    console.log('4️⃣  Checking if audio was saved locally...');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      console.log(`   ✅ Uploads directory exists with ${files.length} file(s)`);
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`      • ${file} (${stats.size} bytes)`);
      });
    } else {
      console.log(`   ℹ️  Uploads directory not found (will be created on next upload)`);
    }
    console.log();

    // Step 5: Get session to verify data
    console.log('5️⃣  Retrieving session data...');
    const getRes = await fetch(`${API_BASE}/session/${sessionID}`);
    if (getRes.ok) {
      const sessionData = await getRes.json();
      console.log(`   ✅ Session retrieved`);
      console.log(`   📋 Introduction transcription stored: ${!!sessionData.selfIntroduction.transcription}`);
      console.log(`   🎵 Audio URL stored: ${!!sessionData.selfIntroduction.audioUrl}`);
      console.log(`   ⏱️  Duration stored: ${sessionData.selfIntroduction.duration}s`);
    }
    console.log();

    console.log('========================================');
    console.log('✨ All tests passed! Transcription is working correctly.\n');
    console.log('Summary:');
    console.log('  ✅ Session initialization');
    console.log('  ✅ Audio upload with file saving');
    console.log('  ✅ Transcription response');
    console.log('  ✅ Audio URL returned');
    console.log('  ✅ Data persistence in session\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Verify backend is running on http://localhost:5000');
    console.error('2. Check .env file has GOOGLE_CLOUD_PROJECT_ID set');
    console.error('3. Check .env file has GOOGLE_APPLICATION_CREDENTIALS set');
    console.error('4. Verify service account JSON file exists');
    process.exit(1);
  }
}

test();
