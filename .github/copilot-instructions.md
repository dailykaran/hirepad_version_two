## Copilot Instructions — AI HR Interviewer MCP (concise)

Purpose: enable AI coding agents to be immediately productive in this repo by documenting
the architecture, critical workflows, integration points, and local commands.

- **Quick start (dev)**:
  - Install: `npm run install-all` (root). 
  - Run dev (frontend + backend): `npm run dev`.
  - Health: `GET http://localhost:5000/health`.

- **Big-picture architecture**:
  - Frontend: React app in `src/frontend/` — `App.jsx` implements four states: `welcome` → `intro` → `interview` → `results`.
  - Backend: Node/Express in `src/backend/` — `index.js` loads `.env` first, initializes MCP client, and mounts routes in `src/backend/routes/index.js`.
  - Services: LLM, speech, and email logic live in `src/backend/services/`:
    - `geminiService.js` — generates 7 questions, evaluates answers, and synthesizes reports (mock fallback when `GEMINI_API_KEY` absent).
    - `speechService.js` — normalizes uploaded audio to LINEAR16 WAV and calls Google Speech-to-Text.
    - `mcpEmailService.js` — spawns MCP transport and sends base64 PDF attachments.

- **Session & data flow**:
  - Sessions stored in-memory (sessions[sessionID]) as defined in `routes/index.js`. Key fields: `selfIntroduction`, `questions[]` (each: `answer`, `evaluation`), `summaryReport`.
  - Upload audio via multipart/form-data endpoints; backend converts/normalizes then transcribes.

- **Critical endpoints (examples)**:
  - `POST /api/session/init` → create session
  - `POST /api/upload-audio/introduction/:id`
  - `POST /api/generate-questions/:id`
  - `POST /api/upload-audio/answer/:id/:qNum`
  - `POST /api/evaluate/:id/:qNum`
  - `POST /api/generate-report/:id`
  - `POST /api/send-report/:id`

- **Environment & secrets**:
  - `.env` must be loaded before other imports — `src/backend/index.js` depends on this ordering.
  - Important vars: `GEMINI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT_ID`, `EMAIL_PROVIDER`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `HR_EMAIL_RECIPIENTS`.

- **Project-specific patterns & conventions**:
  - Audio normalization: backend expects LINEAR16@16000Hz; front-end MediaRecorder blobs are normalized in `speechService.js`.
  - Gemini calls use strict JSON output expectations — callers use `try/catch` around `JSON.parse()` and fall back to mocks.
  - MCP client uses a spawned process via `StdioClientTransport` — watch for the external process lifecycle in logs.
  - **Nodemailer MCP Server** (`src/backend/mcp-servers/nodemailer-mcp-server.js`) implements `send_email` tool via SMTP; spawned when `EMAIL_PROVIDER=smtp`.
  - In-memory sessions are intentionally ephemeral (MVP). Do not assume persistence across restarts.

- **Where to look for examples**:
  - `src/frontend/src/components/RecordingComponent.jsx` — how audio is captured and passed to `useAudioRecorder`.
  - `src/frontend/src/hooks/useAudioRecorder.js` — upload helper and API call flow.
  - `src/backend/routes/index.js` — session lifecycle and endpoint validation.
  - `src/backend/services/geminiService.js` — prompts, temperature settings (`0.7` for Qs, `0.3` for evaluations), and mock mode.

- **Testing & debugging hints**:
  - Use `curl` against endpoints to inspect session objects: `curl http://localhost:5000/api/session/<sessionID>`.
  - Check backend logs for `✅`/`❌` markers showing env and MCP init status.
  - If transcriptions fail, confirm audio normalization and `GOOGLE_APPLICATION_CREDENTIALS` validity.

- **When making changes**:
  - Preserve the `.env` load ordering in `src/backend/index.js`.
  - Keep service boundaries: LLM logic in `geminiService.js`, audio logic in `speechService.js`, email in `mcpEmailService.js`, SMTP in `mcp-servers/nodemailer-mcp-server.js`.
  - Update `MD_Files/` docs (e.g., `API_REFERENCE.md`, `SETUP.md`, `NODEMAILER_SETUP.md`) when changing endpoints or workflows.

If anything here is unclear or you want more detail about a specific file or flow, tell me which area and I'll expand the instructions.
# AI HR Interviewer MCP - Copilot Instructions

## Project Overview
An MVP AI-powered HR recruitment application conducting automated audio interviews using Google Gemini, Speech-to-Text, and MCP for email delivery. The system records candidate responses, transcribes them in real-time, asks AI-generated questions, evaluates answers, and emails comprehensive reports.

## Architecture & Core Components

### Tech Stack
- **Frontend**: React 18 with Hooks (Create React App)
- **Backend**: Node.js/Express (secures API keys, runs MCP client)
- **AI LLM**: Google Gemini 1.5 Flash/Pro (question generation, evaluation, report synthesis)
- **Speech**: Google Cloud Speech-to-Text API (real-time audio transcription)
- **Email**: MCP email server (SendGrid, Gmail, SMTP, or Resend) for automated report delivery
- **PDF**: jsPDF (client-side generation before email)
- **Storage**: In-memory sessions (no database)
- **Runtime**: Node.js 18+ with ES modules (type: "module" in package.json)

### Key Data Flow
```
Browser Recording (Web Audio API)
    ↓ (Audio Blob)
RecordingComponent uploads to backend
    ↓ (POST /api/upload-audio/*)
Speech Service → Google Speech-to-Text API
    ↓ (returns transcription)
Frontend displays in real-time; user confirms
    ↓ (next endpoint call)
Gemini Service → Google Generative AI
    ↓ (questions/evaluation/report as JSON)
MCP Email Service → MCP StdioClientTransport
    ↓ (spawns external process)
SendGrid/Gmail/SMTP → Email to HR_EMAIL_RECIPIENTS
```

### Critical Integration Points
- **Frontend-to-Backend**: Audio upload via multipart/form-data (express-fileupload); all responses are JSON with transcription/questions/evaluations
- **Backend-to-Google APIs**: Credentials from environment (GOOGLE_APPLICATION_CREDENTIALS for Speech, GEMINI_API_KEY for LLM); never expose in frontend
- **Backend-to-MCP Server**: StdioClientTransport spawns separate process (env vars inherited); JSON-RPC 2.0 communication
- **Session Management**: In-memory object per sessionID; stores all interview state until backend restart
- **Gemini Prompt Structure**: System instructions set HR recruiter persona; consistent evaluation criteria across all 7 answers

## Implementation Patterns (Discovered from Codebase)

### Backend Server Architecture (`src/backend/index.js`)
- Loads `.env` from root directory BEFORE other imports (critical for API keys)
- Initializes MCP client asynchronously on startup; logs success/warning status
- Middleware stack: CORS → JSON parser (50MB limit) → audio upload handler → session middleware
- Health check endpoint: `GET /health` returns status + configured email provider
- Graceful shutdown: SIGINT closes MCP client before process exit

### Session State Structure (`src/backend/routes/index.js`)
Sessions stored as `sessions[sessionID]` with exact structure:
```javascript
{
  candidateId: "session_1732000000000_abc123",
  timestamp: "2024-11-20T10:00:00Z",
  selfIntroduction: { audioUrl, transcription, duration },
  questions: [
    { questionNumber: 1, questionText: "...", 
      answer: { audioUrl, transcription, duration }, 
      evaluation: { score: 0-100, feedback, strengths[], improvements[] } 
    }
    // ... 6 more
  ],
  overallAssessment: { totalScore, summary, recommendation },
  summaryReport: { candidateInfo, performanceMetrics, hiringRecommendation, ... }
}
```
- Each endpoint validates `sessions[sessionID]` exists (returns 404 if not)
- Sessions lost on backend restart (MVP limitation)

### Frontend State Machine (`src/frontend/src/App.jsx`)
- 4 distinct states: `welcome` → `intro` → `interview` → `results`
- State transitions only after API calls succeed (prevents race conditions)
- Separate hooks for: sessionID, candidateInfo, currentQuestionIndex, questions[], transcriptions{}, evaluations{}, report, loading, error
- Loading state + error state for all async operations; error message displayed to user

### Audio Recording & Upload Pattern
1. **Frontend**: RecordingComponent uses Web Audio API MediaRecorder → Blob with duration
2. **Frontend**: Calls `uploadAudio(endpoint, blob, duration)` from useAudioRecorder hook
3. **Backend**: express-fileupload extracts audio file → buffer
4. **Backend**: Speech Service converts buffer to LINEAR16 WAV format
5. **Backend**: Uploads to Google Speech-to-Text API with LINEAR16 config
6. **Backend**: Returns `{ transcription: string, audioUrl: string, duration: number }` as JSON
7. **Frontend**: Displays transcription immediately; calls next API (question generation or evaluation)

### Gemini Service Patterns (`src/backend/services/geminiService.js`)
- **Initialization**: Singleton lazy-loaded via `getGeminiClient()` (prevents multiple init attempts)
- **Mock fallback**: If GEMINI_API_KEY not set, returns mock data (development mode, allows testing without API)
- **Question generation**: Sends 1 prompt → receives 7 questions as JSON array
- **Answer evaluation**: For EACH question-answer pair, sends separate Gemini call → receives JSON `{ score: 0-100, feedback, strengths[], improvements[] }`
- **Report synthesis**: After all 7 answers evaluated, generates comprehensive report with metrics + hiring recommendation
- **Temperature**: 0.7 for question generation (creative diversity); 0.3 for evaluation (consistency)
- **Prompts structure**: System instruction sets persona; user message includes context; response format specified as JSON

### MCP Email Service Integration (`src/backend/services/mcpEmailService.js`)
- **Initialization**: Async `initializeMCPClient()` called on backend startup via StdioClientTransport
- **Configuration**: EMAIL_PROVIDER env var determines which MCP server (sendgrid, gmail, smtp, resend)
- **Email sending**: `sendInterviewReportEmail()` called after report generated
- **Email content**: HTML body with candidate info + metrics + performance summary; PDF attached as base64
- **Graceful shutdown**: `closeMCPClient()` closes transport on SIGINT signal
- **Error handling**: Try-catch around MCP calls; fallback error messages returned to API caller

### Frontend Component Communication
- **App.jsx** manages all state; child components stateless
- **RecordingComponent**: Renders recording UI; calls `onComplete(data)` callback with `{ blob, duration }`
- **QuestionDisplay**: Renders question text; displays progress counter "Question X of 7"
- **ResultsDisplay**: Shows final report with scores, recommendation, PDF download/email buttons
- **useAudioRecorder hook**: Provides `uploadAudio()` and `makeRequest()` functions; handles all HTTP communication
- State updates trigger re-renders; loading spinner shown during async operations

### API Endpoints (9 total)
| Method | Route | Input | Output | Side Effects |
|--------|-------|-------|--------|--------------|
| POST | `/api/session/init` | { name, position } | { sessionID } | Creates empty session in memory |
| POST | `/api/upload-audio/introduction/:id` | multipart audio | { transcription, audioUrl, duration } | Stores in session.selfIntroduction |
| POST | `/api/generate-questions/:id` | {} | { questions: [] } | Stores in session.questions; calls Gemini |
| POST | `/api/upload-audio/answer/:id/:qNum` | multipart audio | { transcription, audioUrl, duration } | Stores in question[i].answer |
| POST | `/api/evaluate/:id/:qNum` | {} | { evaluation: {...} } | Stores in question[i].evaluation; calls Gemini |
| POST | `/api/generate-report/:id` | {} | { report: {} } | Stores in session.summaryReport; calls Gemini |
| POST | `/api/send-report/:id` | {} | { success: true, message } | Calls MCP email service; sends to HR_EMAIL_RECIPIENTS |
| GET | `/api/session/:id` | - | { full session object } | No side effects; debug endpoint |
| DELETE | `/api/session/:id` | - | { message: "Session deleted" } | Removes from sessions{} |

## Critical Developer Workflows

### Local Setup
```bash
# 1. Install all dependencies (root + backend + frontend)
npm run install-all

# 2. Create .env in root directory (backend/index.js loads from here)
cp .env.example .env

# 3. Edit .env with required variables:
GEMINI_API_KEY=abc123...                           # From ai.google.dev
GOOGLE_CLOUD_PROJECT_ID=my-project-id             # From Google Cloud Console
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
EMAIL_PROVIDER=sendgrid                            # or: gmail, smtp, resend
SENDGRID_API_KEY=SG.xxx...
SENDGRID_FROM_EMAIL=noreply@company.com
HR_EMAIL_RECIPIENTS=hr@company.com,recruiter@company.com
PORT=5000
NODE_ENV=development

# 4. Start development (concurrent: backend on 5000, frontend on 3000)
npm run dev
```

### Testing Audio + Transcription Pipeline
- Frontend: RecordingComponent uses MediaRecorder API (check browser permissions)
- Record 10-15 second test audio (stays within free tier limits)
- Backend Speech Service converts Blob → WAV LINEAR16 format → uploads to Google API
- Verify transcription appears in UI within 2-5 seconds
- Check Network tab for API response payload structure
- Common issue: Audio Blob codec incompatibility → ensure proper WAV LINEAR16 encoding

### Testing Gemini Integration
- **Question generation**: POST to /generate-questions with intro text → verify 7 questions are diverse (check for repetitive themes)
- **Answer evaluation**: POST to /evaluate with Q+A pair → verify score 0-100, feedback is coherent, strengths/improvements realistic
- **Report synthesis**: POST to /generate-report after all 7 answers → verify metrics calculated correctly, recommendation logical
- All Gemini calls wrapped in try-catch; errors logged with full context
- Free tier: 15 requests/minute, 1M tokens/day → use mock mode (remove GEMINI_API_KEY) for heavy testing

### Testing MCP Email Flow
- Configure SendGrid: set SENDGRID_API_KEY + SENDGRID_FROM_EMAIL (sender email must be verified in dashboard)
- Call `POST /api/send-report/:sessionID` → verify email arrives with PDF attachment
- Check email subject: "Interview Summary - [Candidate Name]"
- Verify HTML body includes: candidate name, position, overall score, communication rating, technical rating, hiring recommendation
- Test with mock responses first: set EMAIL_PROVIDER=mock (or omit SENDGRID_API_KEY) for development

### Debugging Commands & Techniques
```bash
# Check backend health endpoint
curl http://localhost:5000/health

# Inspect session state
curl http://localhost:5000/api/session/[sessionID]

# View backend logs (in terminal where "npm run dev" runs)
# Watch for ✅ (success) and ❌ (error) indicators
# MCP init status, env loading status, API errors logged here

# Check frontend console errors (Browser F12 → Console tab)
# Network requests visible in DevTools Network tab (filter: /api)

# Verify MCP process running
# Windows: tasklist | findstr node
# Mac/Linux: ps aux | grep MCP

# Enable verbose logging (edit backend/index.js or set DEBUG env var)
```

## Project-Specific Conventions & Patterns

### Error Handling Strategy
- **Frontend (React)**: useAPI hook catches errors → sets error state → displays user-friendly message
- **Backend (Express)**: middleware errorHandler catches exceptions → returns `{ error: { status, message } }` JSON
- **Routes**: Validate sessionID exists before processing; return 404 if not found
- **Services**: Return null/empty on failure; log full error internally; never expose credentials in error responses
- **Graceful degradation**: Speech-to-Text failure → user retries audio; Gemini unavailable → mock responses; MCP down → queue for retry

### Gemini Prompt Patterns
- **System prompt** (always): Sets persona as HR recruiter with specific evaluation criteria
- **Question generation prompt**: Instructs to generate exactly 7 questions covering different competencies as JSON array
- **Evaluation prompt**: Specifies `{ score: 0-100, feedback: "...", strengths: [...], improvements: [...] }` JSON format
- **Report synthesis prompt**: Aggregates all 7 answers + evaluations into overall assessment + recommendation
- **Temperature settings**: 0.7 for questions (creativity), 0.3 for evaluations (consistency)
- **JSON validation**: Always try-catch JSON.parse(); fallback to mock data on parse failure

### Session & State Management Specifics
- **Session creation**: POST /session/init → generates unique sessionID (timestamp + random string)
- **Session updates**: Each subsequent endpoint (upload, generate, evaluate) modifies sessions[sessionID] in place
- **Interview phases**: welcome → intro (record self-intro) → interview (7 Q&A loop) → results (display report)
- **State persistence**: Frontend maintains state in React hooks; backend maintains in memory
- **Lifecycle**: Sessions exist until backend restart; production should use database for persistence

### Audio Processing Pipeline
- **Browser**: MediaRecorder emits Blob in native codec (Opus, WebM, etc.)
- **Upload**: FormData with file sent to backend via multipart/form-data
- **Backend**: express-fileupload extracts Buffer → converts to LINEAR16 WAV
- **Google API**: Expects LINEAR16 16000Hz encoding
- **Response**: Transcription string returned; frontend displays immediately
- **File size**: ~1MB per minute of audio; 50MB express limit handles multiple uploads

### PDF & Email Report Delivery
- **Frontend**: jsPDF generates PDF client-side (includes candidate info + metrics + Q&A breakdown + recommendation)
- **Encoding**: PDF converted to base64 string
- **MCP payload**: Base64 PDF embedded in send_email tool call with filename + content-type
- **MCP processing**: Email service parses base64 → creates attachment → sends via SendGrid/Gmail/SMTP
- **SendGrid recommended**: Most reliable for MVP; 100 free emails/day; high delivery rate

## Common Gotchas & Decisions

- **Audio Format Mismatch**: MediaRecorder Blob format varies by browser; backend MUST normalize to LINEAR16 WAV before Speech API or transcription fails
- **Transcription Not Real-time**: Speech-to-Text API is asynchronous; 2-5 second delay between recording end + transcription return (not streaming)
- **Gemini Question Repetition**: Model may repeat themes across questions; explicitly prompt: "Ensure questions cover different competency areas"
- **Evaluation Consistency**: Same system prompt + temperature (0.3) for all 7 questions ensures fairness and consistency
- **MCP Server Process Lifecycle**: Spawned by backend on startup; dies if backend crashes; restart backend to resurrect; no automatic recovery
- **In-Memory Sessions**: Sessions lost on backend restart; production MUST add database + session persistence layer
- **Free Tier Limits**: Gemini (15 requests/minute, 1M tokens/day), Speech-to-Text (60 minutes/month) → each interview uses ~10-15 Gemini calls; monitor carefully
- **CORS Proxy**: Frontend (3000) connects to backend (5000) via package.json proxy in development only; production needs backend URL
- **Error Message Sanitization**: Never expose API keys, credentials, or internal paths in error messages returned to client
- **Env Loading Order**: Backend MUST load .env BEFORE importing services; dotenv.config() must be first import

## File Organization & Key Code Locations

```
src/
  backend/
    index.js                       # Entry point: load .env, init MCP, create Express server, middleware
    middleware/index.js            # CORS, express-fileupload, error handler, session middleware
    routes/index.js                # 9 API endpoints, in-memory sessions storage
    services/
      geminiService.js             # Question generation, answer evaluation, report synthesis
      speechService.js             # Audio transcription via Google Cloud Speech-to-Text
      mcpEmailService.js           # MCP client init/close, email sending, PDF attachment handling
  frontend/
    src/
      App.jsx                      # Main state machine (welcome→intro→interview→results)
      components/
        RecordingComponent.jsx      # Audio recording UI + Web Audio API MediaRecorder
        QuestionDisplay.jsx         # Question display + progress indicator (X of 7)
        ResultsDisplay.jsx          # Report viewer + PDF download button + email form
      hooks/
        useAudioRecorder.js         # uploadAudio() and makeRequest() HTTP helpers
      utils/
        formatters.js              # formatScore(), formatDate(), text formatting utilities
```

## Debugging Tips & Techniques

- **Backend startup**: First check: `.env` loading message + GEMINI_API_KEY/PROJECT_ID status + MCP init status (all logged with ✅/❌)
- **API response inspection**: Browser DevTools Network tab → click request → Response tab → inspect JSON structure
- **Speech-to-Text failures**: Check audio quality, verify LINEAR16 encoding, test with different recording duration, verify Google Cloud credentials valid
- **Gemini JSON parsing errors**: Add console.log before JSON.parse to see raw Gemini response; check for missing required fields in response
- **Session state debugging**: Call `GET /api/session/:id` to inspect full session object at any point; log before/after API calls
- **MCP process visibility**: Set `stdio: 'inherit'` in StdioClientTransport to see MCP process logs in backend console
- **Email delivery issues**: Check SENDGRID_API_KEY valid, sender email verified in SendGrid dashboard, HR_EMAIL_RECIPIENTS formatted correctly
- **Frontend console errors**: Browser F12 → Console tab; check useAPI hook error handling; Network tab shows API call details

## References & Key Resources

- **Specification**: `Claude_Prompt_AI_Interview_MCP.md` (complete MVP requirements + original prompt)
- **Setup Guide**: `SETUP.md` (environment setup, dependency installation, troubleshooting section)
- **Quick Reference**: `QUICK_REFERENCE.md` (5-min overview, command cheatsheet, testing checklist)
- **API Documentation**: `API_REFERENCE.md` (detailed endpoint specifications with curl examples)
- **Architecture Guide**: `BUILD_SUMMARY.md` (file organization, data flows, component descriptions)
- **Google Gemini API**: https://ai.google.dev (models, pricing, authentication)
- **Google Speech-to-Text**: https://cloud.google.com/speech-to-text/docs (audio formats, encoding, configuration)
- **MCP Protocol**: https://modelcontextprotocol.io (protocol spec, available email servers, implementation guide)
- **Express.js**: https://expressjs.com (routing, middleware, error handling, body parsing)
- **React Hooks**: https://react.dev/reference/react (useState, useEffect, custom hooks patterns)
