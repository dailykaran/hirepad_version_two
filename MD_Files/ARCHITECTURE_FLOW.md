# Audio Validation Flow Diagram

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  RecordingComponent                                      │  │
│  │  • Records audio using MediaRecorder (WebM Opus 48kHz)   │  │
│  │  • Sends to backend via multipart/form-data             │  │
│  │  • Displays transcription in UI                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Audio Blob + Duration
                         │ POST /api/upload-audio/*
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  routes/index.js                                         │  │
│  │  • Validates request                                      │  │
│  │  • Extracts audio buffer from multipart                  │  │
│  │  • Logs: 📝 Transcribing..., 📊 File size, ⏱️ Duration  │  │
│  │  • Calls saveAudioLocally()                              │  │
│  │  • Calls transcribeAudio()                               │  │
│  └────────────────┬───────────────────────────────────────┘  │
│                   │ audioBuffer, encoding, sessionID          │
│                   ↓                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  services/speechService.js                               │  │
│  │                                                            │  │
│  │  ┌─ transcribeAudio() ────────────────────────────────┐  │  │
│  │  │ 1. Validate buffer not empty                      │  │  │
│  │  │ 2. Log: 🎙️ Starting transcription...              │  │  │
│  │  │ 3. Call validateAudioBuffer()                     │  │  │
│  │  │    └─> Get formatInfo (WebM/WAV/MP3/UNKNOWN)     │  │  │
│  │  │    └─> Log: 📥 Buffer size                        │  │  │
│  │  │    └─> Log: 📊 Audio format detected             │  │  │
│  │  │ 4. Get Speech API client                          │  │  │
│  │  │ 5. Estimate duration                              │  │  │
│  │  │ 6. Call transcribeAudioInline(formatInfo)         │  │  │
│  │  └─────────────────┬────────────────────────────────┘  │  │
│  │                    │                                    │  │
│  │  ┌─ transcribeAudioInline() ─────────────────────────┐  │  │
│  │  │ 1. Convert buffer to base64                      │  │  │
│  │  │ 2. Create Google API request                     │  │  │
│  │  │ 3. Try SYNC transcription:                       │  │  │
│  │  │    ├─> Log: ✅ Using SYNC, 📡 Calling API       │  │  │
│  │  │    ├─> Call client.recognize()                  │  │  │
│  │  │    └─> SUCCESS                                  │  │  │
│  │  │        └─> Return transcription                 │  │  │
│  │  │    └─> FAILURE: Duration limit error            │  │  │
│  │  │        ├─> Log: ❌ Sync failed                  │  │  │
│  │  │        ├─> Log: 📢 Trying async...              │  │  │
│  │  │        ├─> Try ASYNC transcription:            │  │  │
│  │  │        │   ├─> Log: ⏳ Async operation started │  │  │
│  │  │        │   ├─> Call client.longRunningRecognize()│  │
│  │  │        │   ├─> Poll for results               │  │  │
│  │  │        │   └─> Return transcription           │  │  │
│  │  │        └─> Throw error if async also fails   │  │  │
│  │  └─────────────────┬────────────────────────────────┘  │  │
│  │                    │ transcription: string               │  │
│  │                    ↓                                      │  │
│  │  transcribeAudio() catch block:                         │  │
│  │  └─> Log: ❌ Error, 📢 Using mock transcription       │  │  │
│  │  └─> Return getMockTranscription()                     │  │  │
│  │                                                          │  │
│  └────────────────┬───────────────────────────────────────┘  │
│                   │ { transcription: "...", audioUrl: "..." } │
│                   ↓                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  routes/index.js (response)                              │  │
│  │  • Store transcription in session                        │  │
│  │  • Return JSON response to frontend                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ { transcription, audioUrl }
                         │ Response JSON
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Display transcription in RecordingComponent             │  │
│  │  • Show loading spinner until response                   │  │
│  │  • Display transcription text                            │  │
│  │  • Continue to next question/step                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Audio Format Detection Flow

```
Audio Buffer Received
    │
    ├─→ Check bytes [0-3]
    │
    ├─→ WebM? (1A 45 DF A3)
    │   ├─ YES → Log: "📊 Audio format: WebM"
    │   └─ NO → Continue
    │
    ├─→ WAV? (52 49 46 46)
    │   ├─ YES → Log: "📊 Audio format: WAV"
    │   └─ NO → Continue
    │
    ├─→ MP3? (FF FB or FF FA)
    │   ├─ YES → Log: "📊 Audio format: MP3"
    │   └─ NO → Continue
    │
    └─→ UNKNOWN
        └─ Log: "📊 Audio format: UNKNOWN"

Return: { format, isWebM, isWAV, isMP3 }
```

## Transcription Method Selection Flow

```
Transcription Requested
    │
    ├─→ Validate buffer (not empty)
    │
    ├─→ validateAudioBuffer()
    │   └─→ Log format detected
    │
    ├─→ Estimate duration
    │
    ├─→ Call transcribeAudioInline()
    │   │
    │   ├─→ Try SYNC (client.recognize())
    │   │   │
    │   │   ├─→ SUCCESS ✅
    │   │   │   └─→ Return transcription
    │   │   │       └─→ Log: "✅ Sync transcription successful"
    │   │   │
    │   │   └─→ FAILURE ❌
    │   │       │
    │   │       ├─→ Check error type
    │   │       │
    │   │       ├─→ Duration limit error?
    │   │       │   ├─ YES → Try ASYNC
    │   │       │   └─ NO → Throw error
    │   │       │
    │   │       ├─→ Try ASYNC (client.longRunningRecognize())
    │   │       │   │
    │   │       │   ├─→ SUCCESS ✅
    │   │       │   │   └─→ Return transcription
    │   │       │   │       └─→ Log: "✅ Async transcription successful"
    │   │       │   │
    │   │       │   └─→ FAILURE ❌
    │   │       │       └─→ Throw error
    │   │       │
    │   │       └─→ Error handler: Call getMockTranscription()
    │   │           └─→ Log: "📢 Falling back to mock"
    │   │
    │   └─→ Catch error
    │       ├─→ Log: "❌ Error: {message}"
    │       └─→ Return getMockTranscription()
    │
    └─→ Return transcription to caller
```

## Console Log Output Examples

### ✅ Successful Short Recording (SYNC)
```
🎙️  Starting transcription for session session_1732123456789_abc123...
📥 Audio buffer size: 45000 bytes
📊 Audio format: WebM (header: 1A45DFA3)
📈 Estimated audio duration: 30.0s
📊 Buffer size: 45000 bytes, Format: WebM
✅ Using SYNC transcription with encoding: WEBM_OPUS
📡 Calling Google Speech-to-Text API (sync)...
✅ Sync transcription successful: "Hello, my name is John Smith and I am..."
```

### ⏳ Long Recording Falls Back to ASYNC
```
🎙️  Starting transcription for session session_1732123456789_abc123...
📥 Audio buffer size: 125000 bytes
📊 Audio format: WebM (header: 1A45DFA3)
📈 Estimated audio duration: 83.3s
📊 Buffer size: 125000 bytes, Format: WebM
✅ Using SYNC transcription with encoding: WEBM_OPUS
📡 Calling Google Speech-to-Text API (sync)...
❌ Sync transcription failed: Inline audio exceeds duration limit
📢 Duration error in sync, trying async transcription...
⏳ Async operation started: projects/my-project/locations/us-central1/operations/9876543210
⏳ Polling for results...
✅ Async transcription successful: "I have been working in software development..."
```

### ❌ API Failure Falls Back to Mock
```
🎙️  Starting transcription for session session_1732123456789_abc123...
📥 Audio buffer size: 50000 bytes
📊 Audio format: WebM (header: 1A45DFA3)
📈 Estimated audio duration: 33.3s
📊 Buffer size: 50000 bytes, Format: WebM
✅ Using SYNC transcription with encoding: WEBM_OPUS
📡 Calling Google Speech-to-Text API (sync)...
❌ Error transcribing audio: API key not valid or expired
⚠️  Falling back to mock transcription due to error
```

## Error Handling Paths

```
Audio Upload Request
    │
    ├─→ VALID BUFFER
    │   └─→ Format detected
    │       └─→ Transcription attempt
    │           ├─→ SYNC SUCCESS ✅ → Return transcription
    │           ├─→ SYNC FAILURE (duration) ❌
    │           │   └─→ ASYNC SUCCESS ✅ → Return transcription
    │           │   └─→ ASYNC FAILURE ❌ → Mock transcription
    │           └─→ API FAILURE ❌ → Mock transcription
    │
    ├─→ EMPTY BUFFER
    │   └─→ Error: "Audio buffer is empty"
    │       └─→ Mock transcription
    │
    ├─→ NO FILE UPLOADED
    │   └─→ HTTP 400: "Audio file required"
    │
    └─→ SESSION NOT FOUND
        └─→ HTTP 404: "Session not found"
```

## State Transitions (Per Audio Upload)

```
START
  │
  ├─→ [VALIDATING]
  │   └─→ Buffer not empty? → YES → Continue
  │       └─→ NO → Error & Mock transcription
  │
  ├─→ [FORMAT_DETECTION]
  │   └─→ Read header bytes
  │       └─→ Determine format (WebM/WAV/MP3/UNKNOWN)
  │       └─→ Log format
  │
  ├─→ [SYNC_TRANSCRIPTION]
  │   └─→ Send to Google API (sync method)
  │       ├─→ SUCCESS ✅ → [COMPLETE]
  │       └─→ FAILURE ❌ → [ASYNC_FALLBACK]
  │
  ├─→ [ASYNC_FALLBACK]
  │   └─→ Check if duration error
  │       ├─→ YES → Send to Google API (async method)
  │       │   ├─→ SUCCESS ✅ → [COMPLETE]
  │       │   └─→ FAILURE ❌ → [ERROR_RECOVERY]
  │       └─→ NO → [ERROR_RECOVERY]
  │
  ├─→ [ERROR_RECOVERY]
  │   └─→ Return mock transcription
  │       └─→ [COMPLETE]
  │
  └─→ [COMPLETE]
      └─→ Return transcription (real or mock)
          └─→ Update session
          └─→ Send response to frontend
          └─→ END
```

## Key Decision Points

### Decision 1: Format Detection
```
Is audio format supported?
├─→ WebM (most common) → Proceed with WEBM_OPUS
├─→ WAV (alternative) → Proceed with LINEAR16
├─→ MP3 (alternative) → Proceed with MP3
└─→ UNKNOWN → Proceed anyway (may fail)
```

### Decision 2: Transcription Method
```
Is audio < 60 seconds?
├─→ YES → Use SYNC (fast, immediate)
└─→ NO → Use ASYNC (unlimited duration)
```

### Decision 3: Error Recovery
```
Did transcription fail?
├─→ YES: Duration error → Try ASYNC
├─→ YES: Other error → Use mock
└─→ NO → Return transcription
```

## Performance Metrics

```
Operation                 Typical Time
─────────────────────────────────────
Format detection          < 1 ms
Buffer validation         < 1 ms
SYNC transcription        2-5 seconds
ASYNC transcription       10-60 seconds (depends on audio length)
Mock transcription        < 1 ms
Total for short audio     2-5 seconds
Total for long audio      15-75 seconds
```

## Summary

The audio validation system:
1. **Detects** audio format by reading header bytes
2. **Routes** to appropriate transcription method
3. **Handles** errors gracefully with automatic fallback
4. **Logs** comprehensive information for debugging
5. **Returns** transcription or fallback mock response

Result: Short and long audio recordings work reliably!
