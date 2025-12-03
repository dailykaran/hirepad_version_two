// Simple local SMTP dev server for testing
// Usage: node dev-smtp-server.js
// Listens on port 1025 and prints received messages to console (no delivery)

import { SMTPServer } from 'smtp-server';
import simpleParser from 'mailparser';

const server = new SMTPServer({
  logger: false,
  disabledCommands: ['STARTTLS', 'AUTH'],
  onData(stream, session, callback) {
    simpleParser(stream)
      .then(parsed => {
        console.log('=== New email received ===');
        console.log('From:', parsed.from && parsed.from.text);
        console.log('To:', parsed.to && parsed.to.text);
        console.log('Subject:', parsed.subject);
        if (parsed.text) {
          console.log('Text body:\n', parsed.text);
        }
        if (parsed.html) {
          console.log('HTML body present (not printed)');
        }
        console.log('=== End email ===\n');
      })
      .catch(err => {
        console.error('Failed to parse incoming message', err);
      })
      .finally(() => callback(null));
  },
  onAuth(auth, session, callback) {
    // Accept any credentials for dev server
    callback(null, { user: 'dev' });
  }
});

const PORT = process.env.DEV_SMTP_PORT ? Number(process.env.DEV_SMTP_PORT) : 1025;
server.listen(PORT, () => {
  console.log(`Dev SMTP server listening on port ${PORT}`);
  console.log('Open your mail client to smtp://localhost:' + PORT);
});
