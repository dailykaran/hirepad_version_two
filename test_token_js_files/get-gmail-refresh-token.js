#!/usr/bin/env node

/**
 * Simple Gmail Refresh Token Generator
 * This script helps you get a valid refresh token for Gmail API
 */

import http from 'http';
import { URL } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8080/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env file');
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

let authorizationCode = null;

function createCallbackServer() {
  return http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

    if (parsedUrl.pathname === '/callback') {
      authorizationCode = parsedUrl.searchParams.get('code');

      if (authorizationCode) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>✅ Authorization Successful!</h1>
              <p>You can close this window and check the terminal for your refresh token.</p>
            </body>
          </html>
        `);
        console.log('✅ Authorization code received!');
      } else {
        res.writeHead(400);
        res.end('Authorization failed');
        console.error('❌ Authorization failed');
      }
    } else {
      res.writeHead(404);
      res.end('404 Not Found');
    }
  });
}

(async () => {
  const server = createCallbackServer();

  server.listen(8080, () => {
    console.log('\n🔐 Gmail OAuth Refresh Token Generator\n');
    console.log('📱 Step 1: Open this URL in your browser:\n');

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.send'],
    });

    console.log(authUrl);
    console.log('\nStep 2: Grant permission when prompted');
    console.log('Step 3: You will be redirected - this script will extract your refresh token\n');

    // Wait for authorization code
    const waitForCode = setInterval(async () => {
      if (!authorizationCode) return;

      clearInterval(waitForCode);

      try {
        const { tokens } = await oAuth2Client.getToken(authorizationCode);

        console.log('\n✅ SUCCESS! Your refresh token:\n');
        console.log(tokens.refresh_token);
        console.log('\n📝 Add this to your .env file:');
        console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);

        server.close(() => {
          process.exit(0);
        });
      } catch (error) {
        console.error('❌ Error:', error.message);
        server.close(() => {
          process.exit(1);
        });
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      if (authorizationCode) return;
      clearInterval(waitForCode);
      console.error('\n❌ Timeout: No authorization received within 5 minutes.');
      server.close(() => {
        process.exit(1);
      });
    }, 5 * 60 * 1000);
  });
})();
