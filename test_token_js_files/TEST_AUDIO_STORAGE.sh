#!/bin/bash
# Quick test script for audio storage and transcription display

echo "🧪 Testing Audio Storage & Transcription Display Implementation"
echo "================================================================"
echo ""

echo "✅ Backend File Syntax Checks:"
node -c src/backend/index.js && echo "  - index.js: OK"
node -c src/backend/routes/index.js && echo "  - routes/index.js: OK"
node -c src/backend/services/speechService.js && echo "  - speechService.js: OK"
echo ""

echo "✅ Backend File Structure:"
echo "  - Uploads directory creation: $(grep -q 'mkdirSync' src/backend/index.js && echo 'Implemented' || echo 'Missing')"
echo "  - Static middleware: $(grep -q "express.static(uploadsDir)" src/backend/index.js && echo 'Implemented' || echo 'Missing')"
echo "  - saveAudioLocally function: $(grep -q 'export async function saveAudioLocally' src/backend/services/speechService.js && echo 'Implemented' || echo 'Missing')"
echo ""

echo "✅ Backend Route Updates:"
echo "  - Introduction upload saves audio: $(grep -q 'saveAudioLocally' src/backend/routes/index.js && echo 'Implemented' || echo 'Missing')"
echo "  - Answer upload saves audio: $(grep -q 'answer_' src/backend/routes/index.js && echo 'Implemented' || echo 'Missing')"
echo "  - Routes return audioUrl: $(grep -q 'audioUrl' src/backend/routes/index.js && echo 'Implemented' || echo 'Missing')"
echo ""

echo "✅ Frontend Component Updates:"
echo "  - RecordingComponent transcription prop: $(grep -q 'transcription = null' src/frontend/src/components/RecordingComponent.jsx && echo 'Implemented' || echo 'Missing')"
echo "  - Transcription display: $(grep -q 'transcription-display' src/frontend/src/components/RecordingComponent.jsx && echo 'Implemented' || echo 'Missing')"
echo "  - RecordingComponent.css updated: $(grep -q 'transcription-loading' src/frontend/src/components/RecordingComponent.css && echo 'Implemented' || echo 'Missing')"
echo ""

echo "✅ Frontend App.jsx Updates:"
echo "  - Intro section passes transcription prop: $(grep -q 'transcription={introTranscription}' src/frontend/src/App.jsx && echo 'Implemented' || echo 'Missing')"
echo "  - Interview section passes transcription prop: $(grep -q 'transcriptions\[currentQuestionIndex\]' src/frontend/src/App.jsx && echo 'Implemented' || echo 'Missing')"
echo ""

echo "✅ Dependencies:"
echo "  - @google-cloud/storage: $(grep -q '@google-cloud/storage' src/backend/package.json && echo 'Added' || echo 'Missing')"
echo ""

echo "✅ Build Status:"
cd src/frontend
npm run build > /dev/null 2>&1 && echo "  - Frontend build: SUCCESS" || echo "  - Frontend build: FAILED"
cd ../..
echo ""

echo "================================================================"
echo "✨ All checks complete! Ready for testing."
echo ""
echo "Next steps:"
echo "1. npm install (if dependencies updated)"
echo "2. npm run dev (start development server)"
echo "3. Test recording and verify transcription displays"
echo "4. Check /uploads folder for saved audio files"
