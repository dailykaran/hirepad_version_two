/**
 * Debug MCP SDK to understand how to properly call tools
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function debugMCP() {
  console.log('🧪 Debugging MCP SDK v0.7.0...\n');

  const mcp = new Client(
    { name: 'test', version: '1.0.0' },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, 'mcp-servers', 'nodemailer-mcp-server.js')],
    env: process.env,
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  try {
    console.log('1️⃣ Connecting...');
    await mcp.connect(transport);
    console.log('✅ Connected\n');

    console.log('2️⃣ Available methods on mcp client:');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(mcp))
      .filter(m => !m.startsWith('_') && typeof mcp[m] === 'function');
    console.log(methods.join('\n'));

    console.log('\n3️⃣ Listing tools...');
    const toolsResponse = await mcp.listTools();
    console.log(`Found ${toolsResponse.tools.length} tool(s)`);
    console.log(`Tool names: ${toolsResponse.tools.map(t => t.name).join(', ')}\n`);

    console.log('4️⃣ Attempting to call send_email tool...');
    console.log('   Trying: mcp.callTool()...');
    
    if (typeof mcp.callTool === 'function') {
      console.log('   ✅ mcp.callTool exists\n');
      
      const result = await Promise.race([
        mcp.callTool('send_email', {
          to: ['test@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout after 5s')), 5000)
        ),
      ]);

      console.log('✅ Tool call succeeded!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ mcp.callTool does not exist\n');
      console.log('Available methods:');
      methods.forEach(m => console.log(`   - ${m}`));
    }

    await mcp.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

debugMCP();
