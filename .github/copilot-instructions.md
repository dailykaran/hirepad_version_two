# AI HR Interviewer MCP - Copilot Instructions

## Project Overview
An MVP AI-powered HR recruitment application conducting automated audio interviews using Google Gemini, Speech-to-Text, and MCP for email delivery. The system records candidate responses, transcribes them in real-time, asks AI-generated questions, evaluates answers, and emails comprehensive reports.

## Architecture & Core Components

### Tech Stack
- **Frontend**: React with hooks
- **Backend**: Node.js/Express (secures API keys, runs MCP client)
- **AI LLM**: Google Gemini 1.5 Flash/Pro (question generation, evaluation, report synthesis)
- **Speech**: Google Cloud Speech-to-Text API (real-time audio transcription)
- **Email**: MCP email server (SendGrid, Gmail, SMTP, or Resend) for automated report delivery
- **Storage**: In-memory for MVP (no database)

### Key Data Flow
1. Candidate records audio self-introduction → Backend sends to Speech-to-Text → Transcript to Gemini
2. Gemini generates 7 follow-up questions based on introduction
3. For each of 7 questions: Record audio → Transcribe → Evaluate with Gemini → Store result
4. After all answers: Gemini synthesizes comprehensive report with scores, feedback, hiring recommendation
5. Backend triggers MCP email server to send PDF report to HR recipients with formatted HTML body

### Critical Integration Points
- **Frontend-to-Backend**: POST endpoints for audio upload (multipart/form-data), receive transcripts/questions/evaluations
- **Backend-to-Google APIs**: Use service account credentials (JSON keyfile), never expose in frontend
- **Backend-to-MCP Server**: StdioClientTransport spawns separate process (SendGrid, Gmail, etc.), communicates via JSON-RPC
- **Gemini Prompt Structure**: System instructions define HR recruiter persona; maintain consistent evaluation criteria across all 7 answers

## Critical Developer Workflows

### Local Setup
```bash
# Backend environment variables required
GEMINI_API_KEY=...          # From ai.google.dev
GOOGLE_CLOUD_PROJECT_ID=... # From Google Cloud Console
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
SENDGRID_API_KEY=...        # Or Gmail/SMTP equivalent
SENDGRID_FROM_EMAIL=...
HR_EMAIL_RECIPIENTS=hr@company.com,recruiter@company.com
```

### Testing Audio + Transcription
- Use Web Audio API MediaRecorder on frontend for recording
- Backend receives base64-encoded audio, converts to LINEAR16/FLAC format for Speech-to-Text API
- Test with short 5-10 second recordings before full interview flow
- Verify real-time transcription appears in UI during playback

### Testing Gemini Integration
- Start with question generation: send sample introduction text, verify 7 questions are diverse and relevant
- Test evaluation: send question + answer pairs, verify scores (0-100) and feedback are coherent
- All Gemini calls must be wrapped in error handling (quota limits, API errors)
- Free tier: 15 requests/minute, 1M tokens/day—monitor usage to stay within limits

### Testing MCP Email Flow
- Mock MCP server responses locally before production
- Verify email includes: candidate name, position, overall score, key metrics, PDF attachment
- Test with all three MCP variants if possible (SendGrid most reliable for MVP)
- Confirm email retry logic works if MCP server temporarily unavailable

## Project-Specific Conventions & Patterns

### Data Structure (See Claude_Prompt_AI_Interview_MCP.md for full spec)
- Candidate session object holds all state: intro audio/transcript, 7 question-answer pairs, evaluation results
- Each question-answer includes audio URL, transcription, and evaluation (score, feedback, strengths, improvements)
- Summary report object synthesizes metrics: average score, communication/technical ratings, hiring recommendation level

### Gemini Prompt Patterns
- Use **system instructions** to set evaluator persona (e.g., "You are a professional HR recruiter evaluating candidates")
- Structure user prompts consistently: `"Q: [question]\nA: [candidate_answer]\nEvaluate on relevance, clarity, competency, communication skills. Respond in JSON: {score: 0-100, feedback: '...', strengths: [...], improvements: [...]}"` 
- For question generation: `"Based on: '[introduction]', generate 7 follow-up interview questions as a JSON array"`
- Always parse Gemini responses as JSON; validate structure before using

### Error Handling Specifics
- Speech-to-Text failures: fallback to manual text entry or retry with different audio format
- Gemini quota exceeded: implement exponential backoff (3-5 second retry)
- MCP server connection loss: queue email delivery attempt; retry after 30 seconds
- Audio recording permission denied: show browser permission dialog; guide user
- Frontend catches API errors and displays user-friendly messages; backend logs full error details

### Security/API Key Management
- **Never** embed API keys in React code or send from frontend
- Backend proxy all API calls: frontend → backend → Google APIs/MCP server
- Use environment variables only on backend (.env file not in version control)
- MCP server inherits env vars from backend process; use StdioClientTransport

## Common Gotchas & Decisions

- **Audio Format**: Speech-to-Text expects LINEAR16 or FLAC; MediaRecorder browser output must be converted (use ffmpeg.wasm or similar)
- **Transcription Timing**: Speech-to-Text API is not true real-time; batch requests after recording complete for MVP (not streaming)
- **Question Diversity**: Gemini sometimes repeats themes; add constraint in prompt: "Ensure questions cover different competency areas"
- **Evaluation Consistency**: Use same system prompt + temperature setting (0.3-0.5) for all 7 evaluations to maintain fairness
- **MCP Server Lifecycle**: Backend must spawn MCP process on startup; keep reference alive for entire session
- **PDF Generation**: Use jsPDF or react-pdf for client-side PDF; embed as base64 attachment in MCP email payload
- **Free Tier Constraints**: Each interview uses ~10-15 Gemini API calls (generation + 7 evaluations); 60 speech-to-text minutes/month = ~60 interviews max

## File Organization (When Built)
```
src/
  backend/
    routes/        # /upload-audio, /transcribe, /generate-questions, /evaluate, /send-report
    services/      # geminiService.js, speechService.js, mcpEmailService.js
    middleware/    # audioUpload, errorHandler
  frontend/
    components/    # RecordingComponent, QuestionDisplay, ResultsDisplay
    hooks/         # useAudioRecorder, useAPI
    utils/         # audioConversion, formatters
```

## Debugging Tips
- Enable verbose logging in MCP client: `StdioClientTransport({ stdio: 'inherit' })`
- Google APIs: Use Cloud Console activity logs to view quota usage and errors
- Audio issues: Check browser DevTools → Application → MediaDevices permissions
- Gemini responses malformed: Add `"format": "json"` to generation config
- Session state: Log full candidate object at each phase transition for tracing

## References
- **Specification**: `Claude_Prompt_AI_Interview_MCP.md` (complete MVP requirements)
- **Google Gemini**: https://ai.google.dev/
- **Google Speech-to-Text**: https://cloud.google.com/speech-to-text/docs
- **MCP Protocol**: https://modelcontextprotocol.io/ (see email server options at section "Available Open-Source MCP Email Servers")
