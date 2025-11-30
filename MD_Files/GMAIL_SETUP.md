# Gmail OAuth Setup Guide

## Overview

This guide walks you through setting up Gmail authentication for automated email delivery in the AI HR Interviewer application.

## Quick Start

```bash
# 1. Get Google Cloud credentials
# Go to: https://console.cloud.google.com/apis/credentials

# 2. Add credentials to .env
GMAIL_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret-here

# 3. Run the OAuth token generator
npm run get-gmail-token

# 4. Follow the browser prompts and save the refresh token to .env
GMAIL_REFRESH_TOKEN=refresh_token_from_script
```

## Detailed Setup Steps

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Gmail API**:
   - Click "Enable APIs and Services"
   - Search for "Gmail API"
   - Click "Enable"

### Step 2: Create OAuth 2.0 Credentials

1. Go to [Credentials page](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Desktop application"
4. Download the JSON file (or copy Client ID and Secret)

### Step 3: Set Environment Variables

Edit `.env` in the root directory:

```bash
# Add these two values from Step 2
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
```

### Step 4: Generate Refresh Token

Run the automated script:

```bash
npm run get-gmail-token
```

This will:
1. Start a local server on http://localhost:8080
2. Display a Google login URL
3. Open the URL in your browser (or click the link)
4. Request authorization to send emails
5. Redirect you back to http://localhost:8080/callback
6. Display your refresh token
7. Save it to .env automatically

### Step 5: Save Refresh Token

The script will output:

```
🎉 SUCCESS! Save this to your .env file:
GMAIL_REFRESH_TOKEN=1//0g...
```

Add this line to your `.env` file:

```bash
GMAIL_REFRESH_TOKEN=1//0g...
```

### Step 6: Update Email Configuration

In `.env`, set:

```bash
EMAIL_PROVIDER=gmail
```

## What the Script Does

The `getOauthRefreshToken.js` script:

1. **Reads credentials** from `.env` file
2. **Creates OAuth2 client** with Google APIs
3. **Generates auth URL** for user to authorize
4. **Starts local server** to receive callback
5. **Exchanges auth code** for tokens
6. **Displays refresh token** for you to save
7. **Exits gracefully**

### Script Flow

```
┌─────────────────────────────────────┐
│ npm run get-gmail-token             │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ Validate GMAIL_CLIENT_ID/SECRET     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ Start server on :8080               │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ Display auth URL                    │
│ User clicks link & authorizes       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ Receive callback at /callback       │
│ Extract authorization code          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ Exchange code for tokens            │
│ (access_token + refresh_token)      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ Display tokens                      │
│ Save refresh_token to .env          │
└─────────────────────────────────────┘
```

## Environment Variables Needed

```bash
# Required for running the script
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret

# Generated after running the script
GMAIL_REFRESH_TOKEN=1//0g...

# Optional: For using Gmail in the application
EMAIL_PROVIDER=gmail
HR_EMAIL_RECIPIENTS=hr@company.com,recruiter@company.com
```

## Using Gmail for Email Delivery

Once you have the refresh token, configure the backend:

### Option A: Gmail MCP Server (Recommended)

Install the Gmail MCP server:

```bash
npm install --save-dev @gongrzhe/server-gmail-autoauth-mcp
```

Configure in `.env`:

```bash
EMAIL_PROVIDER=gmail
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=1//0g...
```

### Option B: Direct Gmail API

The backend will use the refresh token to send emails directly:

```javascript
// Backend will automatically use:
// - GMAIL_REFRESH_TOKEN to refresh access tokens
// - Gmail API to send emails
```

## Troubleshooting

### "GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET not found"

**Solution:**
```bash
# Make sure .env has:
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
```

### "Cannot reach http://localhost:8080/callback"

**Possible causes:**
- Port 8080 is already in use
- Firewall blocking localhost
- Browser didn't navigate to callback URL

**Solution:**
```bash
# Kill any process on port 8080
lsof -ti:8080 | xargs kill -9  # Mac/Linux
netstat -ano | findstr :8080   # Windows

# Try again
npm run get-gmail-token
```

### "No refresh token received"

**Causes:**
- Not using `access_type: offline`
- Not using `prompt: consent`
- Wrong client credentials
- Already have an authorized app

**Solution:**
1. Go to https://myaccount.google.com/permissions
2. Find and remove "AI HR Interviewer" app
3. Clear browser cookies for accounts.google.com
4. Run `npm run get-gmail-token` again

### "InvalidArgumentError: invalid_grant"

**Cause:** Refresh token is expired or invalid

**Solution:**
1. Delete old `GMAIL_REFRESH_TOKEN` from `.env`
2. Go to https://myaccount.google.com/permissions and remove the app
3. Run `npm run get-gmail-token` again

## Security Best Practices

✅ **DO:**
- Store refresh token in `.env` (never in code)
- Never commit `.env` to version control
- Use OAuth over password authentication
- Rotate tokens periodically
- Restrict scope to only needed permissions

❌ **DON'T:**
- Commit `.env` file to Git
- Share refresh token in messages/chats
- Use refresh token in frontend code
- Hardcode credentials in source files

## Manual Token Generation

If the automated script doesn't work, you can manually get a refresh token:

1. Visit this URL (replace with your credentials):
```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=YOUR_CLIENT_ID.apps.googleusercontent.com&
  redirect_uri=http://localhost:8080/callback&
  response_type=code&
  scope=https://www.googleapis.com/auth/gmail.send&
  access_type=offline&
  prompt=consent
```

2. Authorize the app
3. Copy the `code` parameter from redirect URL
4. Exchange code for tokens using curl or Postman

## Testing Gmail Integration

Once configured, test email delivery:

```bash
# In backend, the mcpEmailService.js will use:
# - GMAIL_CLIENT_ID
# - GMAIL_CLIENT_SECRET
# - GMAIL_REFRESH_TOKEN

# To test, send a report:
curl -X POST http://localhost:5000/api/send-report/session_123 \
  -H "Content-Type: application/json" \
  -d '{"recipients":["test@gmail.com"]}'
```

## Resources

- [Google Cloud Console](https://console.cloud.google.com/)
- [Gmail API Docs](https://developers.google.com/gmail/api)
- [OAuth 2.0 Reference](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Scopes](https://developers.google.com/gmail/api/auth/scopes)

## Support

If you encounter issues:

1. Check `.env` file has all required variables
2. Verify credentials are correct in Google Cloud Console
3. Check that Gmail API is enabled
4. Review backend logs for error details
5. Try removing the app from permissions and re-authorizing

---

**Need help?** Check `.github/copilot-instructions.md` for development guidelines or SETUP.md for general troubleshooting.
