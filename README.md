# AI HR Interviewer Application

Automated audio interview platform powered by Google Gemini, Speech-to-Text, and MCP for email delivery.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Google Cloud account with APIs enabled
- Email service account (SendGrid, Gmail, SMTP, or Resend)

### Setup

1. **Clone and install dependencies**
   ```bash
   npm install
   npm run install-all
   ```

2. **Configure environment variables**
   - Copy `.env.example` to `.env` in the root directory
   - Fill in your API keys and credentials

3. **Set up Google APIs**
   - Enable Gemini API at https://ai.google.dev/
   - Enable Speech-to-Text API at Google Cloud Console
   - Download service account JSON and reference it in `.env`

4. **Configure email service**
   - Choose one: SendGrid (recommended), Gmail, SMTP, or Resend
   - Set up MCP server with provider credentials

5. **Start the application**
   ```bash
   npm run dev
   ```

   Frontend will be available at `http://localhost:3000`
   Backend will run on `http://localhost:5000`

## Architecture

```
React Frontend (Port 3000)
    ↓
Node.js/Express Backend (Port 5000)
    ↓
├── Google Gemini (Question generation, evaluation, reporting)
├── Google Speech-to-Text (Audio transcription)
└── MCP Email Server (Report delivery)
```

## Features

- **Self-Introduction Recording**: Candidates record and review introduction
- **7-Question Interview**: Dynamically generated questions based on intro
- **Real-time Transcription**: Live text transcription of responses
- **AI Evaluation**: Automatic scoring and feedback for each answer
- **Comprehensive Report**: PDF summary with metrics and recommendation
- **Email Delivery**: Automated report distribution via MCP

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
GEMINI_API_KEY              # Google Gemini API key
GOOGLE_CLOUD_PROJECT_ID    # GCP project ID
GOOGLE_APPLICATION_CREDENTIALS  # Path to service account JSON
EMAIL_PROVIDER              # sendgrid, gmail, smtp, or resend
SENDGRID_API_KEY            # If using SendGrid
HR_EMAIL_RECIPIENTS         # Comma-separated HR email addresses
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

### Test Audio Recording
- Use short 10-15 second test recordings
- Verify transcription appears in UI
- Check browser console for audio permissions

### Test Gemini Integration
- Verify question generation returns 7 diverse questions
- Check evaluation scores are 0-100
- Confirm report structure matches specification

### Test Email Delivery
- Configure SendGrid (easiest for MVP)
- Send test report to your email
- Verify PDF attachment and HTML body

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

### Gemini API Quota Exceeded
- Free tier: 15 requests/minute, 1M tokens/day
- Implement exponential backoff in backend
- Consider upgrading to paid tier for production

### Speech-to-Text Errors
- Verify audio encoding is LINEAR16
- Check audio is not corrupted
- Ensure service account credentials are valid

### MCP Email Delivery Fails
- Verify API key is correct for chosen provider
- Check sender email is verified
- Confirm HR_EMAIL_RECIPIENTS are valid

## Documentation

- `Claude_Prompt_AI_Interview_MCP.md` - Full MVP specification
- `.github/copilot-instructions.md` - AI development guide

## Support

For issues or questions:
1. Check error messages in backend console logs
2. Review browser DevTools console for frontend errors
3. Verify environment variables are set correctly
4. Check API quotas and rate limits

## License

Proprietary - AI HR Interviewer
