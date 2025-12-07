# Hirepad - Setup & Getting Started Guide

## What Was Built

A complete **AI-powered HR recruitment application** with:
- ✅ React frontend with audio recording and real-time UI
- ✅ Node.js/Express backend with secure API handling
- ✅ Google Gemini integration for question generation and evaluation
- ✅ Google Cloud Speech-to-Text for real-time audio transcription
- ✅ MCP email delivery system for automated report distribution
- ✅ In-memory session management (ready for database integration)
- ✅ Comprehensive PDF report generation
- ✅ Full error handling and user feedback

## Project Structure

```
AI_HR_Interviewer_MCP/
├── src/
│   ├── backend/
│   │   ├── services/
│   │   │   ├── geminiService.js          # Gemini API integration
│   │   │   ├── speechService.js          # Speech-to-Text API
│   │   │   └── mcpEmailService.js        # MCP email delivery
│   │   ├── middleware/
│   │   │   └── index.js                  # Express middleware
│   │   ├── routes/
│   │   │   └── index.js                  # API endpoints
│   │   ├── package.json
│   │   └── index.js                      # Server entry point
│   │
│   └── frontend/
│       ├── src/
│       │   ├── components/
│       │   │   ├── RecordingComponent.jsx/.css
│       │   │   ├── QuestionDisplay.jsx/.css
│       │   │   └── ResultsDisplay.jsx/.css
│       │   ├── hooks/
│       │   │   └── useAudioRecorder.js    # Audio & API hooks
│       │   ├── utils/
│       │   │   └── formatters.js          # Utility functions
│       │   ├── App.jsx/.css               # Main app component
│       │   └── index.js
│       ├── public/
│       │   └── index.html
│       └── package.json
│
├── Claude_Prompt_AI_Interview_MCP.md     # Full specification
├── README.md                              # Quick start guide
├── .env.example                           # Environment template
├── .github/copilot-instructions.md       # AI development guide
├── .gitignore
└── package.json                           # Root package.json
```

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies
```bash
# From root directory
npm run install-all
```

### 2. Configure Environment
```bash
# Copy the template
cp .env.example .env

# Edit .env with your credentials:
# - GEMINI_API_KEY from https://ai.google.dev/
# - GOOGLE_CLOUD_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS
# - EMAIL_PROVIDER and related credentials
```

### 3. Get API Keys

**Google Gemini API:**
- Visit https://ai.google.dev/
- Click "Get API Key" → Create new API key
- Paste into `GEMINI_API_KEY` in `.env`

**Google Cloud Speech-to-Text:**
- Go to https://console.cloud.google.com/
- Create project → Enable "Cloud Speech-to-Text API"
- Create service account → Download JSON key
- Save as `service-account.json` in root
- Set `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`

**Email Service (SendGrid recommended):**
```bash
# Option 1: SendGrid (easiest for MVP)
SENDGRID_API_KEY=your_key_from_sendgrid.com
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Option 2: Gmail MCP
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_secret

# Option 3: SMTP (any provider)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### 4. Start Application
```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## 📋 Interview Flow

1. **Welcome** - Enter candidate name and position
2. **Self-Introduction** - Record 2-3 minute intro
3. **Question Generation** - Gemini creates 7 questions
4. **Interview** - Answer each question with audio
5. **Evaluation** - Gemini scores each response
6. **Report** - Comprehensive summary with metrics
7. **Email** - Send PDF report to HR recipients

## 🔑 Key Features

### Backend (`src/backend/`)

**Services:**
- `geminiService.js` - Question generation, answer evaluation, report synthesis
- `speechService.js` - Audio transcription via Google Cloud
- `mcpEmailService.js` - PDF generation and MCP email delivery

**Routes:**
- `POST /api/session/init` - Create new interview session
- `POST /api/upload-audio/introduction/:sessionID` - Record intro
- `POST /api/generate-questions/:sessionID` - Generate 7 questions
- `POST /api/upload-audio/answer/:sessionID/:questionNumber` - Record answer
- `POST /api/evaluate/:sessionID/:questionNumber` - Evaluate single response
- `POST /api/generate-report/:sessionID` - Create comprehensive report
- `POST /api/send-report/:sessionID` - Send via email

### Frontend (`src/frontend/`)

**Components:**
- `RecordingComponent` - Audio recording with visual feedback
- `QuestionDisplay` - Question presentation with progress
- `ResultsDisplay` - Report view with download/email actions

**Hooks:**
- `useAudioRecorder` - Audio recording state management
- `useAPI` - API communication with loading states

## 📊 Data Structure

```javascript
{
  candidateId: "session_123456",
  selfIntroduction: {
    transcription: "My name is...",
    duration: 180
  },
  questions: [
    {
      questionNumber: 1,
      questionText: "Tell us about...",
      answer: {
        transcription: "I would say...",
        duration: 45
      },
      evaluation: {
        score: 85,
        feedback: "Clear and relevant...",
        strengths: ["Good communication"],
        improvements: ["Add more examples"]
      }
    },
    // ... 6 more questions
  ],
  summaryReport: {
    performanceMetrics: {
      averageScore: 82,
      communicationRating: 4,
      technicalRating: 3,
      confidenceLevel: "High"
    },
    hiringRecommendation: {
      level: "Recommended",
      reasoning: "...",
      nextSteps: "..."
    }
  }
}
```

## 🔍 Testing Checklist

### Audio Recording
- [ ] Microphone permission prompt appears
- [ ] Recording timer increments
- [ ] Stop button saves audio
- [ ] Playback works with audio player

### Transcription
- [ ] Audio uploads successfully
- [ ] Transcription appears in UI
- [ ] Handles 30-60 second responses
- [ ] Error handling for malformed audio

### Gemini Integration
- [ ] 7 questions generated successfully
- [ ] Questions are diverse (not repeated)
- [ ] Evaluation returns 0-100 scores
- [ ] Feedback is constructive and relevant

### Report Generation
- [ ] All 7 evaluations included
- [ ] Metrics calculated correctly
- [ ] PDF generates without errors
- [ ] Email sends with attachment

## 🛠 Troubleshooting

### "Microphone access denied"
```bash
# Solution: Check browser permissions
1. Open DevTools → Application → Permissions
2. Allow microphone access for localhost:3000
3. Reload page
```

### "GEMINI_API_KEY not found"
```bash
# Solution: Verify .env file
1. Confirm .env file exists in root directory
2. Check GEMINI_API_KEY value is not empty
3. Test with: curl http://localhost:5000/health
```

### "Speech-to-Text error: 401 Unauthorized"
```bash
# Solution: Fix service account credentials
1. Verify GOOGLE_APPLICATION_CREDENTIALS path
2. Check service-account.json exists
3. Confirm JSON is valid and has correct permissions
```

### "MCP email delivery failed"
```bash
# Solution: Configure email provider
1. Verify EMAIL_PROVIDER is set to valid option
2. Check API keys/credentials for chosen provider
3. Test: curl http://localhost:5000/health (should show email provider)
4. Check backend logs for detailed error
```

### "Frontend can't reach backend"
```bash
# Solution: Verify CORS and proxy
1. Backend running on http://localhost:5000
2. Frontend proxy in package.json: "proxy": "http://localhost:5000"
3. Check backend CORS enabled: cors() middleware present
4. Network tab in DevTools should show requests to /api/*
```

## 📈 Performance Optimization

### For Production:
1. **Replace in-memory storage** with database (MongoDB, PostgreSQL)
2. **Add caching** for frequently accessed questions
3. **Implement rate limiting** on API endpoints
4. **Use CDN** for frontend static assets
5. **Enable gzip compression** in Express
6. **Add request timeouts** for external APIs
7. **Implement job queue** for email delivery (Bull, RabbitMQ)

### API Quotas to Monitor:
- Gemini: 15 requests/minute, 1M tokens/day
- Speech-to-Text: 60 minutes/month free tier
- SendGrid: 100 emails/day free tier

## 📚 Documentation References

- **Full Specification**: `Claude_Prompt_AI_Interview_MCP.md`
- **AI Development Guide**: `.github/copilot-instructions.md`
- **API Reference**: Endpoints listed in route handlers
- **Environment Setup**: `.env.example`

## 🔐 Security Best Practices

1. ✅ API keys stored in `.env` (not in code)
2. ✅ Backend proxies all API calls
3. ✅ Service account credentials never exposed
4. ✅ CORS configured for specific origins
5. ✅ Error messages don't leak sensitive info

**For Production:**
- Use HTTPS/WSS only
- Implement authentication for session access
- Add rate limiting to prevent abuse
- Set up monitoring and alerting
- Regular security audits

## 🚀 Next Steps

1. **Install dependencies** → `npm run install-all`
2. **Configure API keys** → Edit `.env`
3. **Start application** → `npm run dev`
4. **Test interview flow** → Visit http://localhost:3000
5. **Check backend logs** → Monitor http://localhost:5000/health
6. **Deploy to production** → Follow deployment section in README.md

## Support & Debugging

**Enable debug logging:**
```javascript
// In backend/index.js
const DEBUG = process.env.DEBUG === 'true';
console.log = DEBUG ? console.log : () => {};
```

**Check API health:**
```bash
curl http://localhost:5000/health
```

**View network requests:**
- Open DevTools (F12) → Network tab
- Run interview and observe requests to `/api/`

**Backend console output:**
- Shows API initialization
- Logs all API calls and responses
- Displays error stack traces

---

**You're all set! Start the application and conduct your first AI interview.** 🎤📝✨
