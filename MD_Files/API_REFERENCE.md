# API Reference - Hirepad

## Base URL
```
http://localhost:5000/api
```

## Authentication
Currently session-based (no token required). Session ID provided in initialization response.

## Response Format

All responses are JSON. Success responses include data, error responses include error details.

```json
// Success
{
  "data": {...},
  "message": "Success description"
}

// Error
{
  "error": {
    "status": 400,
    "message": "Error description"
  }
}
```

---

## Endpoints

### Session Management

#### Initialize Session
Create a new interview session for a candidate.

```http
POST /api/session/init
Content-Type: application/json

{
  "name": "John Doe",
  "position": "Software Engineer"
}
```

**Response (201):**
```json
{
  "sessionID": "session_1732290000000_abc123def",
  "message": "Session initialized"
}
```

**Error Cases:**
- 400: Missing name or position
- 500: Server error

---

#### Get Session Status
Retrieve current session state and all interview data.

```http
GET /api/session/:sessionID
```

**Response (200):**
```json
{
  "sessionID": "session_1732290000000_abc123def",
  "session": {
    "candidateId": "...",
    "timestamp": "2024-11-28T10:00:00Z",
    "selfIntroduction": {...},
    "questions": [...],
    "summaryReport": {...}
  }
}
```

**Error Cases:**
- 404: Session not found
- 500: Server error

---

#### Delete Session
Remove session and all associated data.

```http
DELETE /api/session/:sessionID
```

**Response (200):**
```json
{
  "message": "Session deleted"
}
```

**Error Cases:**
- 404: Session not found

---

### Audio & Transcription

#### Upload Introduction Audio
Record and transcribe candidate's self-introduction.

```http
POST /api/upload-audio/introduction/:sessionID
Content-Type: multipart/form-data

FormData:
  audio: <audio_file_blob>  // Required: WebM audio blob
  duration: <number>         // Optional: recording duration in seconds
```

**Response (200):**
```json
{
  "transcription": "My name is John and I have 5 years of experience...",
  "message": "Introduction transcribed successfully"
}
```

**Error Cases:**
- 400: Missing audio file or invalid session
- 404: Session not found
- 500: Transcription error

---

#### Upload Answer Audio
Record and transcribe candidate's answer to a question.

```http
POST /api/upload-audio/answer/:sessionID/:questionNumber
Content-Type: multipart/form-data

FormData:
  audio: <audio_file_blob>  // Required: WebM audio blob
  duration: <number>         // Optional: recording duration in seconds
```

**Parameters:**
- `:sessionID` - Session identifier from init
- `:questionNumber` - Question number (1-7)

**Response (200):**
```json
{
  "transcription": "I would approach this by first understanding the requirements...",
  "message": "Answer transcribed successfully"
}
```

**Error Cases:**
- 400: Missing audio file, invalid question number
- 404: Session not found
- 500: Transcription error

---

### Question Generation & Evaluation

#### Generate Interview Questions
Create 7 interview questions based on self-introduction.

```http
POST /api/generate-questions/:sessionID
Content-Type: application/json

{}
```

**Response (200):**
```json
{
  "questions": [
    "Can you describe your most significant professional achievement?",
    "How do you handle conflict in a team environment?",
    "What technical skills are you most proud of?",
    "Tell us about a time you overcame a major challenge.",
    "How do you stay updated with industry trends?",
    "What are your career goals for the next 5 years?",
    "Why are you interested in this specific position?"
  ],
  "message": "Questions generated successfully"
}
```

**Error Cases:**
- 400: Introduction transcription not found
- 404: Session not found
- 500: Gemini API error, quota exceeded

---

#### Evaluate Answer
Score and provide feedback on a candidate's answer.

```http
POST /api/evaluate/:sessionID/:questionNumber
Content-Type: application/json

{}
```

**Parameters:**
- `:sessionID` - Session identifier
- `:questionNumber` - Question number (1-7)

**Response (200):**
```json
{
  "evaluation": {
    "score": 82,
    "feedback": "Clear answer with good examples. Could provide more specific metrics.",
    "strengths": [
      "Well-structured response",
      "Provided concrete examples",
      "Demonstrated problem-solving approach"
    ],
    "improvements": [
      "Include quantifiable outcomes",
      "Elaborate on team collaboration aspects"
    ]
  },
  "message": "Answer evaluated successfully"
}
```

**Error Cases:**
- 400: Answer transcription not found
- 404: Session not found
- 500: Gemini API error

---

### Report Generation

#### Generate Summary Report
Create comprehensive interview evaluation report.

```http
POST /api/generate-report/:sessionID
Content-Type: application/json

{}
```

**Response (200):**
```json
{
  "report": {
    "candidateInfo": {
      "name": "John Doe",
      "position": "Software Engineer",
      "interviewDate": "2024-11-28T10:00:00Z",
      "duration": 1320
    },
    "introductionHighlights": [
      "5 years of software development experience",
      "Proven leadership in team settings",
      "Strong technical foundation"
    ],
    "performanceMetrics": {
      "averageScore": 81.4,
      "communicationRating": 4,
      "technicalRating": 4,
      "confidenceLevel": "High"
    },
    "topStrengths": [
      "Problem-solving ability",
      "Communication clarity",
      "Technical expertise"
    ],
    "areasForImprovement": [
      "Provide more quantifiable metrics",
      "Expand on collaborative experiences"
    ],
    "hiringRecommendation": {
      "level": "Recommended",
      "reasoning": "Strong technical skills and communication abilities align well with role requirements.",
      "nextSteps": "Schedule technical interview with engineering team"
    },
    "reportGeneratedAt": "2024-11-28T10:25:00Z"
  },
  "message": "Report generated successfully"
}
```

**Error Cases:**
- 400: Questions or evaluations incomplete
- 404: Session not found
- 500: Report generation error

---

#### Send Report via Email
Deliver interview report to HR recipients via MCP email server.

```http
POST /api/send-report/:sessionID
Content-Type: application/json

{
  "recipients": [
    "hr@company.com",
    "recruiter@company.com"
  ]
}
```

**Response (200):**
```json
{
  "message": "Report sent successfully",
  "result": {
    "emailsSent": 2,
    "status": "delivered"
  }
}
```

**Alternative Response (200 - Email failed but report exists):**
```json
{
  "message": "Report generated but email delivery failed",
  "report": {...},
  "emailError": "MCP server not configured"
}
```

**Error Cases:**
- 400: No recipients provided, invalid email addresses
- 404: Session not found
- 500: Email service error

---

## Health Check

#### Server Status
Check backend health and configuration status.

```http
GET /health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-11-28T10:25:00Z",
  "environment": {
    "nodeEnv": "development",
    "emailProvider": "sendgrid"
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created (new session) |
| 400 | Bad request (missing parameters, invalid data) |
| 404 | Not found (session, endpoint) |
| 429 | Rate limited (API quota exceeded) |
| 500 | Server error (API failures, service errors) |

---

## Common Error Responses

### Missing Required Parameter
```json
{
  "error": {
    "status": 400,
    "message": "Request body is required"
  }
}
```

### Session Not Found
```json
{
  "error": {
    "status": 404,
    "message": "Session not found"
  }
}
```

### API Quota Exceeded
```json
{
  "error": {
    "status": 429,
    "message": "Gemini API rate limit exceeded. Retry in 30 seconds."
  }
}
```

### Transcription Error
```json
{
  "error": {
    "status": 500,
    "message": "Transcription failed: Invalid audio format"
  }
}
```

---

## Rate Limits

**Gemini API:**
- 15 requests/minute
- 1,000,000 tokens/day
- Automatic retry with exponential backoff

**Speech-to-Text:**
- 60 minutes/month (free tier)
- ~1 minute per interview

**Email (via MCP):**
- Depends on chosen provider
- SendGrid: 100 emails/day (free tier)

---

## Request/Response Examples

### Complete Interview Flow

```bash
# 1. Initialize session
curl -X POST http://localhost:5000/api/session/init \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Smith","position":"Product Manager"}'

# Response: { "sessionID": "session_123456789" }

# 2. Upload introduction (audio file required)
curl -X POST http://localhost:5000/api/upload-audio/introduction/session_123456789 \
  -F "audio=@introduction.webm" \
  -F "duration=120"

# 3. Generate questions
curl -X POST http://localhost:5000/api/generate-questions/session_123456789

# 4. Upload answers (repeat for questions 1-7)
curl -X POST http://localhost:5000/api/upload-audio/answer/session_123456789/1 \
  -F "audio=@answer1.webm" \
  -F "duration=45"

# 5. Evaluate answers (repeat for questions 1-7)
curl -X POST http://localhost:5000/api/evaluate/session_123456789/1

# 6. Generate report
curl -X POST http://localhost:5000/api/generate-report/session_123456789

# 7. Send email
curl -X POST http://localhost:5000/api/send-report/session_123456789 \
  -H "Content-Type: application/json" \
  -d '{"recipients":["hr@company.com"]}'
```

---

## Frontend Integration

The React frontend (`src/frontend/src/App.jsx`) handles:
- Audio recording via Web Audio API
- Multipart form uploads for audio files
- Session state management
- Error handling and user feedback
- PDF download (client-side with jsPDF)

**Base API URL Configuration:**
```javascript
// In frontend package.json
"proxy": "http://localhost:5000"

// API calls use relative paths
fetch('/api/session/init', {...})
```

---

## Monitoring & Debugging

**Enable verbose logging:**
```bash
# Backend
DEBUG=true npm run dev

# View network requests
# Browser DevTools → Network tab → filter by /api
```

**Check session data:**
```bash
curl http://localhost:5000/api/session/session_123456789
```

**Health check:**
```bash
curl http://localhost:5000/health
```

---

**Last Updated:** November 28, 2024
