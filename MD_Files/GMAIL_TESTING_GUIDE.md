# Gmail Email Delivery Testing Guide

This guide explains how to test Gmail email delivery in the AI HR Interviewer application.

## Step 1: Verify Gmail API is Enabled

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (GCP Project ID)
3. Go to **APIs & Services** → **Library**
4. Search for "Gmail API"
5. Click it and press **ENABLE**

## Step 2: Check OAuth Consent Screen Configuration

1. Go to **APIs & Services** → **OAuth consent screen**
2. Make sure it's set to **External** user type
3. Add your test email as a Test user
4. Ensure scopes include: `https://www.googleapis.com/auth/gmail.send`

## Step 3: Verify Your `.env` File

Check that your `.env` has all required Gmail variables:

```bash
EMAIL_PROVIDER=gmail
# Get these values from Google Cloud Console OAuth2 setup
GMAIL_CLIENT_ID=YOUR_CLIENT_ID_HERE
GMAIL_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
# Get this by running: node get-gmail-refresh-token.js
GMAIL_REFRESH_TOKEN=YOUR_REFRESH_TOKEN_HERE
GMAIL_REDIRECT_URI=http://localhost:3000/auth/callback
HR_EMAIL_RECIPIENTS=hr@company.com,recruiter@company.com
```

## Step 4: Test Email Delivery

### Option A: Test via API Endpoint Directly

```bash
# 1. Start the backend
npm run dev

# 2. Initialize a session
curl -X POST http://localhost:5000/api/session/init \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","position":"Software Engineer"}'

# Example response: {"sessionID":"session_1732000000000_abc123"}

# 3. Send test email (replace sessionID with actual one)
curl -X POST http://localhost:5000/api/send-report/session_1732000000000_abc123 \
  -H "Content-Type: application/json" \
  -d '{"recipients":["your-email@gmail.com"]}'
```

### Option B: Test via Frontend (Full Flow)

1. Start the application: `npm run dev`
2. Open http://localhost:3000
3. Fill in candidate info (name, position)
4. Record a 10-15 second self-introduction
5. Complete all 7 question answers
6. At results screen, check the **HR_EMAIL_RECIPIENTS** field
7. Click "Send Report" button
8. Check your email inbox for the PDF

### Option C: Direct Test Script

Create a test file `test-gmail.js`:

```javascript
import { sendInterviewReportEmail } from './src/backend/services/mcpEmailService.js';
import dotenv from 'dotenv';

dotenv.config();

const testSession = {
  summaryReport: {
    candidateInfo: {
      name: "Test Candidate",
      position: "Senior Developer",
      interviewDate: new Date().toISOString()
    },
    performanceMetrics: {
      averageScore: 85,
      communicationRating: 4,
      technicalRating: 4
    },
    strengthsAndWeaknesses: {
      topStrengths: ["Strong problem solving", "Clear communication"]
    },
    hiringRecommendation: {
      level: "Highly Recommended",
      reasoning: "Excellent fit for role",
      nextSteps: "Schedule final interview"
    }
  }
};

(async () => {
  try {
    const result = await sendInterviewReportEmail(
      testSession, 
      ['your-email@gmail.com']
    );
    console.log('✅ Email sent successfully:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
})();
```

Run it:
```bash
node test-gmail.js
```

## Step 5: Check for Errors

If you get `unauthorized_client` error:

1. **Refresh token expired**: Run `npm run get-gmail-token` to generate a new one
2. **Wrong Client ID/Secret**: Verify they match in Google Cloud Console
3. **Gmail API not enabled**: Check step 1 above
4. **Test user not added**: Check step 2 above

## Step 6: Check Gmail Logs

View detailed Gmail API activity:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services** → **Dashboard**
3. Click **Gmail API**
4. Check recent requests and errors

## Troubleshooting Commands

### Check Gmail Configuration
```bash
grep -E "GMAIL|EMAIL" .env
```

### Test Gmail Authentication
```bash
node -e "
import('googleapis').then(({ google }) => {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  auth.refreshAccessToken().then(() => {
    console.log('✅ Gmail auth works!');
  }).catch(e => {
    console.error('❌ Auth failed:', e.message);
  });
})"
```

### View Backend Logs
```bash
npm run dev 2>&1 | grep -i gmail
```

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| `unauthorized_client` error | Refresh token expired or invalid Client ID/Secret |
| `Gmail API not enabled` | Enable Gmail API in Google Cloud Console |
| `Test user not configured` | Add your email to OAuth consent screen test users |
| `Invalid redirect URI` | Ensure `GMAIL_REDIRECT_URI` matches Google Cloud settings |
| `Email not received` | Check Gmail spam folder or verify recipient email is correct |

## Expected Success Response

When email is sent successfully, you should see:

```json
{
  "id": "abc123...",
  "threadId": "xyz789..."
}
```

And in the backend logs:
```
✅ Email sent successfully via Gmail API
```

## Next Steps

- Once testing is complete, update `HR_EMAIL_RECIPIENTS` in `.env` with actual HR email addresses
- Deploy to production with verified Gmail credentials
- Monitor Gmail API quota usage in Cloud Console
