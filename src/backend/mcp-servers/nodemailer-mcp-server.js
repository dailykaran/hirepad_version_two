#!/usr/bin/env node
/**
 * Clean Nodemailer MCP Server
 * - Uses McpServer.registerTool to expose `send_email` tool
 * - Minimal, robust, with clear logs to verify handler invocation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z3 from 'zod/v3';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

let transporter = null;

function initializeTransporter() {
  if (transporter) return;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const useTLS = process.env.SMTP_USE_TLS !== 'false';
  // Dev-mode: allow a stream transport which doesn't require network SMTP.
  const devMode = (smtpHost === 'stream') || (process.env.SMTP_DEV_MODE === 'stream') || (process.env.SMTP_DEV === 'true');
  if (devMode) {
    transporter = nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });
    console.error('[nodemailer-mcp] ✅ Nodemailer initialized in DEV stream mode (emails will be returned as streams)');
    return;
  }

  if (!smtpHost || !smtpUser || !smtpPassword) {
    console.error('[nodemailer-mcp] ❌ Missing SMTP configuration (SMTP_HOST/SMTP_USER/SMTP_PASSWORD)');
    throw new Error('Missing SMTP configuration');
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPassword },
    tls: useTLS ? { rejectUnauthorized: false } : undefined,
  });

  console.error(`[nodemailer-mcp] ✅ Nodemailer initialized (${smtpHost}:${smtpPort})`);
}

async function handleSendEmail(args) {
  try {
    initializeTransporter();

    const { to, subject, html, text, from, attachments } = args || {};
    if (!to || !subject) throw new Error('Missing required fields: to, subject');

    const processedAttachments = Array.isArray(attachments)
      ? attachments.map(att => {
        let content = att.content;
        if (typeof content === 'string') {
          try { content = Buffer.from(content, 'base64'); } catch (e) { /* keep as-is */ }
        }
        return { filename: att.filename, content, contentType: att.type || 'application/octet-stream' };
      })
      : [];

    const mailOptions = {
      from: from || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html: html || text,
      text,
      attachments: processedAttachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.error(`[nodemailer-mcp] ✅ Email sent: ${info.messageId} to ${mailOptions.to}`);

    return { content: [{ type: 'text', text: JSON.stringify({ success: true, messageId: info.messageId, recipients: Array.isArray(to) ? to : [to] }) }] };
  } catch (err) {
    console.error('[nodemailer-mcp] ❌ send_email error:', err && err.message);
    return { isError: true, content: [{ type: 'text', text: `Failed to send email: ${err && err.message}` }] };
  }
}

const mcpServer = new McpServer({ name: 'nodemailer-mcp-server', version: '1.0.0' }, { capabilities: { tools: {} } });

// Register a minimal send_email tool with clear logs
mcpServer.registerTool('send_email', {
  title: 'Send Email',
  description: 'Send an email via SMTP using nodemailer',
  // Provide a permissive Zod v3 schema so the MCP server will pass parsed arguments to the callback.
  inputSchema: z3.record(z3.any())
}, async (args, extra) => {
  console.error('[nodemailer-mcp] 🔧 send_email invoked (handler start)');
  console.error('[nodemailer-mcp] 🔍 args keys: ' + Object.keys(args || {}).join(', '));
  const res = await handleSendEmail(args);
  console.error('[nodemailer-mcp] 🔧 send_email handler finished');
  return res;
});

async function main() {
  try {
    console.error('[nodemailer-mcp] 🔗 Connecting to StdioServerTransport');
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error('[nodemailer-mcp] 🚀 MCP Server connected and ready');
  } catch (err) {
    console.error('[nodemailer-mcp] ❌ startup error:', err && err.message);
    console.error(err && err.stack);
    process.exit(1);
  }
}

process.on('SIGINT', () => { console.error('[nodemailer-mcp] 🛑 SIGINT, exiting'); process.exit(0); });
process.on('SIGTERM', () => { console.error('[nodemailer-mcp] 🛑 SIGTERM, exiting'); process.exit(0); });

main().catch(err => { console.error('[nodemailer-mcp] Fatal:', err); process.exit(1); });
