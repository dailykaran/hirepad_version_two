# Audio Duration Limit Fix

## Problem
Google Cloud Speech-to-Text API returns error:
```
Error transcribing audio: 3 INVALID_ARGUMENT: Inline audio exceeds duration limit. Please use a GCS URI.
```

## Root Cause
The Speech-to-Text API has strict limits for inline audio (using `recognize()` method):
- **Inline audio limit**: ~1 minute maximum
- **Synchronous recognize()**: Limited to short audio only
- **Long audio**: Must use `longRunningRecognize()` or GCS URIs

The error indicates that audio exceeding the inline limit is being sent to the sync endpoint.

## Solution Implemented

### 1. **Audio Duration Estimation**
Added function to estimate audio duration from buffer size:
```javascript
function estimateAudioDuration(audioBuffer, sampleRateHertz = 48000)
```
- Calculates approximate duration based on buffer size and sample rate
- Uses conservative estimates for safety

### 2. **Automatic GCS Upload for Large Files**
Added `uploadAudioToGCS()` function:
- Uploads audio files > 10MB to Google Cloud Storage
- Returns GCS URI for processing by Speech API
- GCS URIs can handle audio of any length

### 3. **Smart Transcription Strategy**
Updated `transcribeAudio()` function with three-tier approach:

| Audio Size | Duration | Method | Details |
|-----------|----------|--------|---------|
| < 10MB | < 1 min | Inline Sync | Fast, immediate response |
| < 10MB | 1-5 min | Inline Async | `longRunningRecognize()` |
| > 10MB | Any | GCS URI | Upload to storage first |

### 4. **Separated Transcription Logic**
Created focused functions:
- `transcribeAudioInline()`: Handles inline transcription with sync/async fallback
- `transcribeAudioFromGCS()`: Handles GCS URI-based transcription
- `transcribeAudio()`: Routes to appropriate method based on file size

### 5. **Better Error Handling**
Enhanced error detection:
- Catches `"Inline audio exceeds duration limit"` error
- Catches error code `3` (INVALID_ARGUMENT)
- Automatically falls back to `longRunningRecognize()`
- Logs detailed progress indicators (⚡ sync, ⏱️ async, 📤 GCS upload, etc.)

### 6. **Improved Logging**
Added visual progress indicators:
```
📊 Estimated audio duration: 2.5s, Buffer size: 45000 bytes
⚡ Using sync transcription (for audio < 1 minute)...
⏱️ Audio too long for sync, using async long-running transcription...
📤 Audio file is large, uploading to GCS for transcription...
⏳ Waiting for operation to complete...
```

## Configuration Required

### 1. **GCS Bucket Setup** (Optional but Recommended)
If you need to handle audio > 5 minutes:

```bash
# Create a GCS bucket for audio transcriptions
gsutil mb gs://hirepad-audio-transcriptions

# Set bucket name in .env (optional, defaults to 'hirepad-audio-transcriptions')
GCS_BUCKET_NAME=hirepad-audio-transcriptions
```

### 2. **Permissions**
Ensure your service account has these permissions:
```
storage.buckets.get
storage.objects.create
storage.objects.delete
```

These are included in `roles/storage.objectAdmin` or `roles/editor`.

### 3. **Dependencies**
New dependency added to `src/backend/package.json`:
```json
"@google-cloud/storage": "^7.0.0"
```

## How It Works

### Short Audio (< 1 minute, < 10MB)
```
Audio Upload → Sync Recognize → Transcription (2-5 seconds)
```

### Medium Audio (1-5 minutes, < 10MB)
```
Audio Upload → LongRunningRecognize → Poll for completion → Transcription
```

### Large Audio (> 10MB or > 5 minutes)
```
Audio Upload → GCS Upload → LongRunningRecognize with GCS URI → Poll → Transcription
```

## Testing

### Test 1: Short Audio
```bash
curl -X POST http://localhost:5000/api/upload-audio/introduction/test-session \
  -F "audio=@short-clip.webm" \
  -F "duration=15"
```
Expected: Fast transcription in 2-5 seconds

### Test 2: Long Audio (if available)
```bash
curl -X POST http://localhost:5000/api/upload-audio/introduction/test-session \
  -F "audio=@long-recording.webm" \
  -F "duration=120"
```
Expected: Async processing with longer wait time

## Troubleshooting

### Error: "GCS not available, cannot upload long audio"
- Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to valid service account key
- Verify service account has storage permissions
- Create GCS bucket or set `GCS_BUCKET_NAME` in `.env`

### Error: "403 Forbidden" when uploading to GCS
- Check service account permissions
- Ensure bucket exists and is accessible
- Verify service account key is valid

### Still Getting "Inline audio exceeds duration limit"
- Clear browser cache
- Try a fresh audio recording (shorter than 1 minute)
- Check estimated duration in backend logs
- If duration > 5 minutes, ensure GCS is properly configured

## Performance Notes

- **Sync transcription**: 2-5 seconds (inline, < 1 minute audio)
- **Async transcription**: 10-60 seconds (depends on audio length)
- **GCS upload**: 5-30 seconds (depends on file size and internet speed)
- **Total for long audio**: Upload time + transcription time

## Migration Note

This fix is **backward compatible**:
- Existing code works without changes
- If audio exceeds limits, automatically handles gracefully
- No breaking changes to API signatures
- GCS is optional - system works without it for audio < 5 minutes

## Files Modified

1. **`src/backend/services/speechService.js`**
   - Added GCS client initialization
   - Added audio duration estimation
   - Added GCS upload function
   - Split transcription logic into specialized functions
   - Enhanced error handling

2. **`src/backend/routes/index.js`**
   - Pass `sessionID` to `transcribeAudio()` for GCS operations

3. **`src/backend/package.json`**
   - Added `@google-cloud/storage` dependency

## References

- [Google Cloud Speech-to-Text Limits](https://cloud.google.com/speech-to-text/quotas)
- [Google Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [Speech API Long-Running Recognize](https://cloud.google.com/speech-to-text/docs/async-recognize)
