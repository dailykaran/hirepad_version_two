/**
 * Test MCP server directly
 */
import { spawn } from 'child_process';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testMCP() {
  console.log('🧪 Testing MCP Server...\n');

  const mcp = new Client(
    { name: 'test', version: '1.0.0' },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, 'mcp-servers', 'nodemailer-mcp-server.js')],
    env: {
      ...process.env,
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '587',
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASSWORD: process.env.SMTP_PASSWORD,
      SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
    },
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  try {
    console.log('Connecting to MCP server...');
    await Promise.race([
      mcp.connect(transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      ),
    ]);
    console.log('✅ Connected to MCP server\n');

    console.log('Testing send_email tool...');
    const result = await Promise.race([
      mcp.callTool('send_email', {
        to: ['test@example.com'],
        subject: 'Test Email',
        html: '<p>Test message</p>',
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tool call timeout')), 5000)
      ),
    ]);

    console.log('Tool result:', result);
    await mcp.close();
    console.log('✅ Test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testMCP();
