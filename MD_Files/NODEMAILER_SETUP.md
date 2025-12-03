# Nodemailer MCP Server Setup Guide

## Overview
The **Nodemailer MCP Server** (`src/backend/mcp-servers/nodemailer-mcp-server.js`) is a Model Context Protocol server that enables SMTP email delivery via nodemailer. It implements the `send_email` tool and works with various email providers (Gmail, Outlook, SendGrid SMTP, AWS SES, custom SMTP servers, etc.).

## Architecture
- **MCP Server**: Runs as a separate Node.js process spawned by `mcpEmailService.js`
- **Tool**: Implements `send_email(to, subject, html, attachments)` 
- **Transport**: StdioServerTransport (JSON-RPC over stdin/stdout)
- **Email**: Nodemailer creates SMTP connection and sends via SMTP protocol

## Environment Variables

### Required
```bash
SMTP_HOST              # SMTP server hostname (e.g., smtp.gmail.com)
SMTP_PORT              # SMTP port (e.g., 587 for TLS, 465 for SSL)
SMTP_USER              # SMTP username or email address
SMTP_PASSWORD          # SMTP password or app-specific password
```

### Optional
```bash
SMTP_FROM_EMAIL        # Default sender email (falls back to SMTP_USER if not set)
SMTP_USE_TLS           # Use TLS encryption (true/false, default: true)
EMAIL_PROVIDER         # Set to 'smtp' to use this MCP server
SMTP_MCP_SERVER_PATH   # Custom path to nodemailer-mcp-server.js (optional override)
```

## Configuration Examples

### Gmail (with App Password)
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_USE_TLS=true
```

**Note**: Enable 2-factor authentication, then generate an "App Password" at https://myaccount.google.com/apppasswords

### Outlook / Microsoft 365
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=your-email@outlook.com
SMTP_USE_TLS=true
```

### SendGrid SMTP Relay
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_USE_TLS=true
```

### AWS SES (Simple Email Service)
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Replace region as needed
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
SMTP_FROM_EMAIL=verified-sender@yourdomain.com
SMTP_USE_TLS=true
```

### Custom SMTP Server
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_USER=admin@example.com
SMTP_PASSWORD=admin-password
SMTP_FROM_EMAIL=noreply@example.com
SMTP_USE_TLS=true
```

### Local Testing (MailHog / Ethereal Email)
**Ethereal Email** (temporary test account):
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=temporary-test-email@ethereal.email
SMTP_PASSWORD=test-password
SMTP_FROM_EMAIL=test@example.com
SMTP_USE_TLS=true
```

**MailHog** (local Docker):
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=user  # Not required for MailHog
SMTP_PASSWORD=pass
SMTP_FROM_EMAIL=noreply@localhost
SMTP_USE_TLS=false
```

## How It Works

### Data Flow
1. **Frontend**: User uploads audio → AI generates report
2. **Backend (`/api/send-report`)**: Calls `sendInterviewReportEmail(session, recipients)`
3. **mcpEmailService.js**: 
   - Initializes MCP client (spawns `nodemailer-mcp-server.js` as separate process)
   - Generates PDF report via jsPDF
   - Calls `mcpClient.callTool('send_email', { ... })`
4. **Nodemailer MCP Server**:
   - Receives JSON-RPC call over stdio
   - Decodes base64 PDF attachment
   - Creates SMTP transporter with env vars
   - Calls `transporter.sendMail(mailOptions)`
   - Returns success/error response to client
5. **Frontend**: Displays confirmation or error message

### Tool Input Schema
```javascript
{
  to: "recipient@example.com" | ["recipient1@example.com", "recipient2@example.com"],
  subject: "Interview Summary - Candidate Name",
  html: "<html>Email body in HTML</html>",
  text: "Email body in plain text (optional)",
  from: "sender@example.com (optional, defaults to SMTP_FROM_EMAIL)",
  attachments: [
    {
      filename: "Interview_Report.pdf",
      content: "base64-encoded-pdf-bytes",
      type: "application/pdf",
      disposition: "attachment"
    }
  ]
}
```

### Tool Output
**Success**:
```json
{
  "success": true,
  "messageId": "<message-id-from-smtp>",
  "response": "250 Message accepted",
  "recipients": ["recipient@example.com"]
}
```

**Error**:
```json
{
  "isError": true,
  "message": "Failed to send email: [error details]"
}
```

## Troubleshooting

### Email Not Sending
1. **Check .env file**: Ensure `EMAIL_PROVIDER=smtp` is set
2. **Verify credentials**: Test SMTP credentials manually
   ```bash
   # On Windows PowerShell
   npm install -g telnet
   # Test SMTP connection
   ```
3. **Check logs**: Look for `✅ Nodemailer transporter initialized` in backend console
4. **Verify firewall**: SMTP port (587 or 465) may be blocked

### "Missing SMTP configuration" Error
- Verify all required env vars are set: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- Check `.env` file is in root directory (`d:\Dinakaran_Files\AI\AI_HR_Interviewer_MCP\.env`)

### Gmail Authentication Failed
- Ensure 2-factor authentication is enabled
- Generate App Password at https://myaccount.google.com/apppasswords
- Use the 16-character App Password (no spaces) in `SMTP_PASSWORD`

### Timeout / Connection Refused
- Check SMTP_HOST and SMTP_PORT are correct
- Verify network/firewall allows SMTP port
- Try with `SMTP_USE_TLS=false` if TLS is causing issues (not recommended for production)

### Base64 Decoding Issues
- MCP server expects `attachments[].content` to be base64-encoded
- jsPDF PDF output is automatically base64-encoded by `mcpEmailService.js`
- Check `generatePDFReport()` output is valid before attaching

## Testing

### Test Email Sending Manually
```javascript
// src/backend/test-nodemailer.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});

await transporter.sendMail({
  from: 'your-email@gmail.com',
  to: 'test@example.com',
  subject: 'Test',
  html: '<p>Test email</p>'
});
```

### Test via cURL (after backend running)
```bash
curl -X POST http://localhost:5000/api/send-report/session_123
```

Then check:
1. Backend logs for MCP server initialization
2. Email inbox for received message
3. Backend logs for `✅ Email sent successfully` message

## Development Mode

If SMTP is not configured:
- Email sending is skipped (graceful degradation)
- Backend logs warning: `⚠️  Email delivery will not be available`
- Frontend shows: "Email delivery skipped - MCP client not available"
- This is intentional for MVP/development — no external email needed

To enable email:
1. Set `EMAIL_PROVIDER=smtp`
2. Configure SMTP env vars (see examples above)
3. Restart backend: `npm run dev`

## Security Considerations

- **Never commit `.env`** with real credentials to git
- **Use environment variables** for all secrets (passwords, API keys)
- **For production**: Use secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)
- **App passwords**: For Gmail, use generated App Passwords instead of account password
- **TLS/SSL**: Always enable `SMTP_USE_TLS=true` for production (encrypts credentials in transit)
- **Firewall**: Restrict SMTP port access to authorized sources only

## References

- **Nodemailer docs**: https://nodemailer.com/ (transport options, troubleshooting)
- **Gmail App Passwords**: https://myaccount.google.com/apppasswords
- **SendGrid SMTP**: https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api
- **AWS SES SMTP**: https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html
- **MCP Protocol**: https://modelcontextprotocol.io/

