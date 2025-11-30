# Quick Testing Guide: Audio Validation Fix

## TL;DR
The audio format validation system is now implemented. Here's how to test it:

## 1. Start the Backend
```bash
cd src/backend
node index.js
```

You should see:
```
✅ Backend server running on http://localhost:5000
```

## 2. Make a Test Audio Upload
```bash
# Record 30 seconds of audio and upload to intro endpoint
curl -X POST http://localhost:5000/api/upload-audio/introduction/test_session \
  -F "audio=@test_audio.webm" \
  -F "duration=30"
```

## 3. Check Backend Console
Look for these log messages:

### ✅ Success Indicators
```
🎙️  Starting transcription for session test_session...
📥 Audio buffer size: 50000 bytes
📊 Audio format: WebM (header: 1A45DFA3)
📈 Estimated audio duration: 30.0s
✅ Using SYNC transcription with encoding: WEBM_OPUS
📡 Calling Google Speech-to-Text API (sync)...
✅ Sync transcription successful: "Hello, my name is..."
```

### ⚠️ Fallback to Async (Expected for longer audio)
```
❌ Sync transcription failed: Inline audio exceeds duration limit
📢 Duration error in sync, trying async transcription...
⏳ Async operation started: projects/.../operations/abc123
⏳ Polling for results...
✅ Async transcription successful: "I have been working..."
```

## 4. Validation Checklist

### Format Detection
- [ ] WebM format detected: `📊 Audio format: WebM`
- [ ] WAV format detected: `📊 Audio format: WAV`
- [ ] MP3 format detected: `📊 Audio format: MP3`
- [ ] Unknown format shows: `📊 Audio format: UNKNOWN`

### Transcription Method
- [ ] Short audio (< 60s): Uses SYNC method
- [ ] Longer audio (>= 60s): Uses ASYNC method
- [ ] Sync failure triggers: ASYNC fallback

### Error Handling
- [ ] Empty buffer: Returns error message
- [ ] Invalid file: Returns error message
- [ ] API failure: Falls back to mock transcription
- [ ] Timeout: Handled gracefully

## 5. Test Cases

### Test 1: 30-Second Recording (Sync)
```
Duration: 30 seconds
Expected: ✅ Using SYNC transcription
Expected: ✅ Sync transcription successful
Time: ~2-5 seconds
```

### Test 2: 2-Minute Recording (Async)
```
Duration: 120 seconds
Expected: ✅ Using SYNC transcription (initially)
Expected: ❌ Sync transcription failed: duration limit
Expected: 📢 Duration error in sync, trying async transcription...
Expected: ⏳ Async operation started
Expected: ✅ Async transcription successful
Time: ~10-30 seconds
```

### Test 3: Very Short Recording (Sync)
```
Duration: 5 seconds
Expected: ✅ Using SYNC transcription
Expected: ✅ Sync transcription successful
Time: ~2-5 seconds
```

### Test 4: Browser Test
1. Go to http://localhost:3000
2. Enter candidate name and position
3. Click "Start Interview"
4. Record a 30-second introduction
5. Check browser console for transcription
6. Check backend terminal for logging

## 6. Debug Commands

### Check Speech Service Syntax
```bash
node -c src/backend/services/speechService.js
# Should return no errors
```

### Check Routes Syntax
```bash
node -c src/backend/routes/index.js
# Should return no errors
```

### Run Audio Validation Tests
```bash
node test-audio-validation.js
# Should show: ✅ All tests completed!
```

### Check Port Availability
```bash
netstat -ano | findstr :5000
# If nothing shows, port is available
```

## 7. What to Look For

### ✅ Good Signs
- Backend starts without errors
- Format is detected (WebM/WAV/MP3/UNKNOWN)
- Transcription method selected (SYNC/ASYNC)
- Transcription successful message
- Transcription appears in frontend UI
- Backend console has emoji indicators (🎙️ 📥 📊 ✅)

### ❌ Bad Signs
- "Cannot find module" errors
- Syntax errors when checking
- Backend won't start
- "Port already in use" error
- No format detected
- Transcription always fails
- Mock transcription used instead

## 8. Troubleshooting

### Issue: Backend won't start
**Solution**:
```bash
# Kill any existing node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait 2 seconds
Start-Sleep -Seconds 2

# Try again
cd src/backend && node index.js
```

### Issue: Port 5000 already in use
**Solution**:
```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill it (replace PID with the number shown)
taskkill /PID <PID> /F

# Or just kill all node processes
Get-Process node | Stop-Process -Force
```

### Issue: Audio format shows "UNKNOWN"
**Note**: This is OK, system will still try to transcribe with provided encoding

### Issue: Transcription always fails
**Check**:
1. Is GOOGLE_APPLICATION_CREDENTIALS set correctly?
2. Does service account have Speech-to-Text permissions?
3. Is GEMINI_API_KEY (for fallback) set?
4. Check Google Cloud quota usage

### Issue: Mock transcription always used
**Likely**: Google API error, check:
- Service account credentials validity
- Network connectivity
- API quotas/limits
- Error messages in console

## 9. Success Criteria

### All checks must pass ✅

| Check | Result |
|-------|--------|
| Backend starts | ✅ |
| Format detected | ✅ |
| Sync works for short audio | ✅ |
| Async works for long audio | ✅ |
| Error fallback works | ✅ |
| Logging shows emojis | ✅ |
| Frontend receives transcription | ✅ |
| No syntax errors | ✅ |

## 10. Real-World Test Flow

1. **Setup**
   - Start backend: `cd src/backend && node index.js`
   - Start frontend: `cd src/frontend && npm start`
   - Browser opens to http://localhost:3000

2. **Record Introduction**
   - Click "Start Interview"
   - Record 30-45 second self-introduction
   - Click upload/done

3. **Monitor Backend**
   ```
   🎙️  Starting transcription for session session_xxx...
   📥 Audio buffer size: 45000 bytes
   📊 Audio format: WebM (header: 1A45DFA3)
   ✅ Using SYNC transcription with encoding: WEBM_OPUS
   📡 Calling Google Speech-to-Text API (sync)...
   ✅ Sync transcription successful: "Hello, my name is John Smith..."
   ```

4. **Verify Frontend**
   - Transcription appears in UI
   - Questions load successfully
   - Continue with interview

5. **Answer Questions**
   - Record 1-minute answer
   - Backend should show async being used
   - Transcription appears in UI

## 11. Files to Monitor

### Backend Logs
- `src/backend/index.js` - Server startup logs
- `src/backend/services/speechService.js` - Format validation & transcription logs
- `src/backend/routes/index.js` - Upload endpoint logs

### Check Console Output
- Run backend in terminal (not background)
- Watch console for real-time logs
- Use emoji prefix to search: 🎙️ 📥 📊 ✅ ❌ ⚠️ ⏳

## 12. Advanced: Add Custom Logging

To add more detailed logging, edit `src/backend/services/speechService.js`:

```javascript
// Find this section:
console.log(`📈 Estimated audio duration: ${estimatedDuration.toFixed(1)}s`);
console.log(`📊 Buffer size: ${audioBuffer.length} bytes, Format: ${formatInfo.format}`);

// Add after it:
console.log(`🔍 Detailed Format: ${JSON.stringify(formatInfo)}`);
```

Then test and you'll see:
```
🔍 Detailed Format: {"format":"WebM","isWebM":true,"isWAV":false,"isMP3":false}
```

## Need Help?

Check these files:
- `AUDIO_VALIDATION_FIX.md` - Comprehensive technical documentation
- `IMPLEMENTATION_COMPLETE.md` - Implementation summary
- `test-audio-validation.js` - Format detection test suite
- `src/backend/services/speechService.js` - Source code with comments
