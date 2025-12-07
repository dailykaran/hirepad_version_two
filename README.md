# Hirepad

Automated audio interview platform powered by Google Gemini, Speech-to-Text, and Gmail for email delivery. Features real-time audio transcription, AI-powered evaluation, and comprehensive interview reports.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Google Cloud account with Gemini and Speech-to-Text APIs enabled
- Gmail account with App Password or OAuth2 credentials for email delivery

### Setup

1. **Clone and install dependencies**
   ```bash
   npm install
   npm run install-all
   ```

2. **Configure environment variables**
   - Copy `.env.example` to `.env` in the root directory
   - Fill in your API keys and credentials (see Environment Variables section)

3. **Set up Google APIs**
   - Enable Gemini API at https://ai.google.dev/
   - Enable Speech-to-Text API at Google Cloud Console
   - Download service account JSON and reference it in `.env`

4. **Configure Gmail for email delivery**
   - Option A: Use Gmail App Password (easiest)
     - Enable 2-factor authentication in Google Account
     - Generate App Password for Gmail
     - Set `GMAIL_PASSWORD` in `.env`
   - Option B: Use OAuth2 (recommended for production)
     - Create OAuth2 credentials in Google Cloud Console
     - Run: `node get-gmail-refresh-token.js`
     - Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` in `.env`

5. **Start the application**
   ```bash
   npm run dev
   ```

   Frontend will be available at `http://localhost:3000`
   Backend will run on `http://localhost:5000`

## Architecture

```
React Frontend (Port 3000)
    ↓ Audio Blob + Duration
    ↓
Node.js/Express Backend (Port 5000)
    ├── Audio Validation & Format Detection
    ├── Local Audio Storage (/uploads)
    ├── Google Speech-to-Text (Sync < 60s, Async > 60s)
    ├── Google Gemini (Question generation, evaluation, reporting)
    └── Gmail API (Report delivery)
```

### Data Flow

```
Browser Recording (MediaRecorder WebM Opus 48kHz)
    ↓
Backend: validateAudioBuffer() - detects format
    ↓
saveAudioLocally() - stores to /uploads
    ↓
transcribeAudio() - chooses sync/async method
    ↓
Google Speech-to-Text API
    ↓
Frontend: Display transcription in real-time
    ↓
Next: Generate questions or evaluate answer
```

## Features

- **Self-Introduction Recording**: Candidates record, review, and confirm introduction with real-time transcription
- **7-Question Interview**: Dynamically generated questions based on candidate introduction and role
- **Real-time Audio Transcription**: Live text transcription with automatic sync/async method selection
- **Audio Format Detection**: Intelligent detection of WebM, WAV, and MP3 audio formats
- **Local Audio Storage**: Recordings saved locally to `/uploads` directory for reference and debugging
- **AI Evaluation**: Automatic scoring (0-100) and detailed feedback for each answer
- **Comprehensive Report**: PDF summary with metrics, strengths, weaknesses, and hiring recommendation
- **Gmail Integration**: Automated report delivery with PDF attachment via Gmail API
- **Error Recovery**: Graceful fallback mechanisms for API failures with mock transcriptions

## API Endpoints

### Session Management
- `POST /api/session/init` - Initialize new interview session
- `GET /api/session/:sessionID` - Get session status
- `DELETE /api/session/:sessionID` - Delete session

### Audio & Transcription
- `POST /api/upload-audio/introduction/:sessionID` - Upload intro audio
- `POST /api/upload-audio/answer/:sessionID/:questionNumber` - Upload answer audio

### Questions & Evaluation
- `POST /api/generate-questions/:sessionID` - Generate 7 interview questions
- `POST /api/evaluate/:sessionID/:questionNumber` - Evaluate single answer
- `POST /api/generate-report/:sessionID` - Generate comprehensive report

### Email
- `POST /api/send-report/:sessionID` - Send report via email

## Environment Variables

See `.env.example` for complete configuration. Key variables:

```
# Google Gemini API
GEMINI_API_KEY                      # Google Gemini API key from ai.google.dev
GOOGLE_CLOUD_PROJECT_ID             # GCP project ID for Speech-to-Text
GOOGLE_APPLICATION_CREDENTIALS      # Path to service account JSON file

# Email Configuration (Gmail)
EMAIL_PROVIDER                      # Set to 'gmail'
GMAIL_CLIENT_ID                     # OAuth2 client ID
GMAIL_CLIENT_SECRET                 # OAuth2 client secret
GMAIL_REFRESH_TOKEN                 # OAuth2 refresh token (get via get-gmail-refresh-token.js)
GMAIL_PASSWORD                      # Alternative: Gmail app password
HR_EMAIL_RECIPIENTS                 # Comma-separated HR email addresses for reports

# Server Configuration
PORT                                # Backend port (default: 5000)
NODE_ENV                            # 'development' or 'production'
```

## Project Structure

```
src/
├── backend/
│   ├── services/           # Gemini, Speech-to-Text, MCP services
│   ├── routes/             # API endpoints
│   ├── middleware/         # Express middleware
│   └── index.js           # Server entry point
└── frontend/
    ├── src/
    │   ├── components/     # React components
    │   ├── hooks/          # Custom hooks
    │   ├── utils/          # Utilities & formatters
    │   └── App.jsx        # Main app component
    └── public/
        └── index.html     # HTML template
```

## Development

### Backend
- Entry point: `src/backend/index.js`
- Services in `src/backend/services/`
- Routes in `src/backend/routes/`

### Frontend
- Entry point: `src/frontend/src/index.js`
- Main component: `src/frontend/src/App.jsx`
- Styling in component CSS files

### Running in Development
```bash
npm run dev
```
This runs both backend (with nodemon) and frontend simultaneously.

## Testing

### Test Audio Recording & Transcription
```bash
# Test short recording (< 60 seconds)
# Expected: SYNC transcription, 2-5 second response

# Test long recording (> 60 seconds)
# Expected: Falls back to ASYNC transcription, 10-60 second response

# Check logs for format detection:
# 📊 Audio format: WebM (header: 1A45DFA3)
```

### Test Gemini Integration
- Verify question generation returns 7 diverse questions
- Check evaluation scores are 0-100
- Confirm report structure with metrics and recommendation

### Test Gmail Integration
- Verify `GMAIL_REFRESH_TOKEN` is set correctly
- Send test report from candidate page
- Check email arrives with PDF attachment
- Verify HR_EMAIL_RECIPIENTS receives the report

### Run Test Suite
```bash
# Audio validation tests
node test-audio-validation.js

# Transcription testing
node test_transcription.js

# Gmail setup verification
node test_gmail.js
```

## Deployment

### Environment Preparation
1. Set all `.env` variables on target server
2. Use secure secret management (AWS Secrets Manager, Azure Key Vault, etc.)
3. Never commit `.env` file to version control

### Backend Deployment
```bash
cd src/backend
npm install --production
NODE_ENV=production node index.js
```

### Frontend Deployment
```bash
cd src/frontend
npm run build
# Deploy build/ directory to CDN or static host
```

## Troubleshooting

### Microphone Permission Denied
- Check browser permissions in DevTools → Application
- Restart browser and try again
- Use HTTPS in production

### Audio Format Not Detected / Transcription Fails
- Check backend console for: `📊 Audio format: WebM (header: ...)`
- If format shows UNKNOWN, transcription still attempts but may fail
- Verify audio buffer size is > 0 bytes
- Check Google Speech-to-Text quota and rate limits

### Gemini API Quota Exceeded
- Free tier: 15 requests/minute, 1M tokens/day
- Mock transcriptions and evaluations used as fallback
- Consider upgrading to paid tier for production

### Gmail Email Not Received
- Verify `GMAIL_REFRESH_TOKEN` is valid (run `get-gmail-refresh-token.js`)
- Check HR_EMAIL_RECIPIENTS are correct (comma-separated)
- Confirm Gmail account has SMTP enabled
- Check spam folder for test emails
- Verify `EMAIL_PROVIDER=gmail` in .env

### Speech-to-Text Errors

**"Inline audio exceeds duration limit"**
- For audio < 60s: System automatically retries with async method
- If persists: Check audio format detection logs
- Verify GOOGLE_APPLICATION_CREDENTIALS path is correct

**"API key not valid or expired"**
- Verify GOOGLE_APPLICATION_CREDENTIALS file exists and is readable
- Check service account has Speech-to-Text permissions
- Regenerate service account key if needed

### Audio Files Not Saved
- Check `/uploads` directory exists and is writable
- Verify disk space available
- Backend creates uploads directory automatically on startup

## Documentation

For detailed information about specific features:

### Setup & Configuration
- `SETUP.md` - Step-by-step setup guide
- `GMAIL_SETUP.md` - Gmail OAuth2 configuration
- `GMAIL_TESTING_GUIDE.md` - Gmail testing procedures
- `.env.example` - Configuration template

### Audio & Transcription
- `AUDIO_VALIDATION_FIX.md` - Audio format validation implementation
- `TESTING_GUIDE.md` - Quick testing reference
- `ARCHITECTURE_FLOW.md` - System architecture and data flow diagrams

### Implementation Details
- `Claude_Prompt_AI_Interview_MCP.md` - Full MVP specification
- `IMPLEMENTATION_COMPLETE.md` - Implementation summary
- `.github/copilot-instructions.md` - AI development guide
- `API_REFERENCE.md` - Complete API endpoint documentation

### Deployment
- `DEPLOYMENT_CHECKLIST.md` - Pre/post deployment verification

## Support

For issues or questions:
1. Check error messages in backend console logs
2. Review browser DevTools console for frontend errors
3. Verify environment variables are set correctly
4. Check API quotas and rate limits

## License

Proprietary - Hirepad

## Recent Updates

### Audio Processing Enhancements (Latest)
- ✅ Audio format validation (WebM, WAV, MP3 detection)
- ✅ Dual transcription methods (SYNC for <60s, ASYNC for longer)
- ✅ Automatic sync-to-async fallback on duration errors
- ✅ Local audio file storage to `/uploads`
- ✅ Comprehensive emoji-based logging for debugging

### Email Delivery
- ✅ Gmail API integration with OAuth2 and App Password support
- ✅ Direct Gmail sending (removed MCP dependency)
- ✅ PDF attachment support with jsPDF
- ✅ Configurable HR email recipients

### Quality Improvements
- ✅ Better error handling and recovery
- ✅ Enhanced logging and debugging capabilities
- ✅ Comprehensive test suite with 5+ unit tests
- ✅ Extensive documentation and guides

For complete changelog, see individual documentation files.
