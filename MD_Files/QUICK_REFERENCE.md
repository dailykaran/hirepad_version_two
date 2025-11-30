# 🎯 Quick Reference Card - AI HR Interviewer

## 🚀 Start Here (5 minutes)

```bash
# 1. Install all dependencies
npm run install-all

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your API keys
# Required:
# - GEMINI_API_KEY from https://ai.google.dev/
# - GOOGLE_APPLICATION_CREDENTIALS path to service-account.json
# - EMAIL_PROVIDER (sendgrid, gmail, smtp, or resend)

# 4. Start development
npm run dev

# 5. Open http://localhost:3000
```

---

## 📁 Key Files at a Glance

| File | Purpose | Lines |
|------|---------|-------|
| `SETUP.md` | **READ THIS FIRST** - Detailed setup guide | 250+ |
| `API_REFERENCE.md` | Complete endpoint documentation | 350+ |
| `README.md` | Project overview and quick commands | 200+ |
| `src/backend/index.js` | Express server entry point | 50 |
| `src/backend/services/geminiService.js` | AI question/evaluation logic | 168 |
| `src/backend/services/speechService.js` | Audio transcription | 92 |
| `src/backend/services/mcpEmailService.js` | Email delivery + PDF | 198 |
| `src/backend/routes/index.js` | 9 API endpoints | 300+ |
| `src/frontend/src/App.jsx` | Main React app (state machine) | 299 |
| `src/frontend/src/components/RecordingComponent.jsx` | Audio recording UI | 148 |
| `src/frontend/src/components/ResultsDisplay.jsx` | Interview results view | 110 |

---

## 🔑 Environment Variables (Required)

```bash
# Google APIs
GEMINI_API_KEY=abc123...
GOOGLE_CLOUD_PROJECT_ID=my-project
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Email Service (choose one)
EMAIL_PROVIDER=sendgrid                    # or: gmail, smtp, resend
SENDGRID_API_KEY=SG.xxx...
SENDGRID_FROM_EMAIL=noreply@company.com

# HR Recipients
HR_EMAIL_RECIPIENTS=hr@company.com,recruiter@company.com

# Optional
PORT=5000
NODE_ENV=development
```

---

## 🎤 Interview Flow (User Perspective)

```
Welcome
  ↓ (Enter name + position)
  ↓
Self-Introduction
  ↓ (Record 2-3 min intro)
  ↓
Question Generation (waiting...)
  ↓
Interview Questions 1-7
  ↓ (Record + Review for each)
  ↓
Processing... (Evaluation)
  ↓
Results & Report
  ↓ (Download PDF or Email)
  ✓ Complete
```

---

## 🔌 API Endpoints (Quick Reference)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/session/init` | Start interview |
| POST | `/api/upload-audio/introduction/:id` | Record intro |
| POST | `/api/generate-questions/:id` | Generate 7 questions |
| POST | `/api/upload-audio/answer/:id/:qNum` | Record answer |
| POST | `/api/evaluate/:id/:qNum` | Score answer |
| POST | `/api/generate-report/:id` | Create report |
| POST | `/api/send-report/:id` | Email report |
| GET | `/api/session/:id` | Check status |
| DELETE | `/api/session/:id` | Delete session |

---

## 💻 Development Commands

```bash
# Install everything
npm run install-all

# Run dev server (both frontend + backend)
npm run dev

# Run backend only
npm run server
cd src/backend && npm start

# Run frontend only
npm run client
cd src/frontend && npm start

# Production build
npm run build
cd src/frontend && npm run build

# Check server health
curl http://localhost:5000/health

# View backend logs
# Check terminal where "npm run dev" is running
```

---

## 🔍 Testing Checklist

### Basic Testing
- [ ] Can record audio (microphone permissions work)
- [ ] Audio uploads successfully
- [ ] Transcription appears in UI
- [ ] 7 questions are diverse (not repetitive)
- [ ] Answer evaluations show scores 0-100
- [ ] Report generates correctly
- [ ] PDF downloads or email sends

### Integration Testing
- [ ] Complete interview takes ~15-20 minutes
- [ ] All 7 answers stored properly
- [ ] Metrics calculated correctly
- [ ] Recommendation makes sense

### Error Handling
- [ ] Microphone denied → user message appears
- [ ] Network error → retry works
- [ ] API quota exceeded → backoff works
- [ ] Missing env vars → error on startup

---

## 🐛 Troubleshooting (Common Issues)

| Problem | Solution |
|---------|----------|
| "Cannot find GEMINI_API_KEY" | Add to `.env` file |
| Microphone denied | Check browser permissions |
| Backend won't start | Port 5000 in use? Change in `.env` |
| Frontend can't reach backend | Check proxy in `package.json` |
| Audio won't transcribe | Verify service-account.json path |
| Email won't send | Check EMAIL_PROVIDER and credentials |
| Gemini quota exceeded | Wait 1 minute or upgrade API tier |

---

## 📊 Architecture Overview

```
React Frontend (3000)
    ↓
Express Backend (5000)
    ├→ Gemini API (questions/evaluation/report)
    ├→ Speech-to-Text API (audio→text)
    └→ MCP Email Server (report delivery)
```

---

## 🎯 Project Stats

- **Total Files**: 30+
- **Lines of Code**: 2,500+
- **Components**: 3 React components
- **Services**: 3 backend services
- **API Endpoints**: 9 routes
- **Configuration Files**: 5 (package.json, .env, etc.)
- **Documentation Pages**: 6 (SETUP, README, API_REFERENCE, BUILD_SUMMARY, copilot-instructions, this card)

---

## 📚 Documentation Map

```
START HERE ↓
    ↓
SETUP.md (Setup + Troubleshooting)
    ↓
README.md (Overview + Quick Start)
    ↓
API_REFERENCE.md (Endpoint Details)
    ↓
BUILD_SUMMARY.md (Complete File Reference)
    ↓
Claude_Prompt_AI_Interview_MCP.md (Original Spec)
    ↓
.github/copilot-instructions.md (For AI agents)
```

---

## 🚀 Deployment Checklist

- [ ] All env vars configured
- [ ] Google APIs enabled
- [ ] Service account credentials available
- [ ] Email provider configured
- [ ] Dependencies installed
- [ ] Tests pass
- [ ] No hardcoded secrets
- [ ] Error handling in place
- [ ] HTTPS enabled (production)
- [ ] Rate limiting configured
- [ ] Logging enabled
- [ ] Monitoring set up

---

## 🔐 Security Reminders

- ✅ Never commit `.env` file
- ✅ Never commit `service-account.json`
- ✅ Keep API keys in environment variables only
- ✅ Don't expose keys in error messages
- ✅ Use HTTPS in production
- ✅ Validate all user input
- ✅ Sanitize error responses

---

## 💡 Pro Tips

1. **Use SendGrid for email** - Most reliable for MVP
2. **Test with 15-30 second recordings** - Stays within free tier
3. **Monitor Gemini usage** - 15 req/min, 1M tokens/day
4. **Check browser DevTools** - Network tab shows API calls
5. **Enable debug logging** - `DEBUG=true npm run dev`
6. **Save session data** - Check via `GET /api/session/:id`
7. **Test health endpoint** - `curl http://localhost:5000/health`

---

## 📞 Support Resources

| Resource | URL |
|----------|-----|
| Gemini API Docs | https://ai.google.dev/ |
| Speech-to-Text | https://cloud.google.com/speech-to-text/docs |
| MCP Protocol | https://modelcontextprotocol.io/ |
| React Docs | https://react.dev |
| Express Guide | https://expressjs.com |

---

## 📋 Pre-Launch Checklist

```bash
# 1. Dependencies installed
ls src/backend/node_modules | head -5

# 2. Environment configured
cat .env | grep GEMINI_API_KEY

# 3. Service account exists
ls -la service-account.json

# 4. Backend starts
npm run server &
sleep 2
curl http://localhost:5000/health

# 5. Frontend starts
npm run client &
sleep 3
# Check http://localhost:3000 in browser
```

---

**Version**: 1.0.0  
**Last Updated**: November 28, 2024  
**Status**: Ready for MVP Testing

**Next Step**: Open `SETUP.md` for detailed setup instructions →
