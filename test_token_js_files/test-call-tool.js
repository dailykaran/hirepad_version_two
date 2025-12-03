import('@modelcontextprotocol/sdk/client/stdio.js').then(async (clientMod) => {
  import('@modelcontextprotocol/sdk/client/index.js').then(async (mod) => {
    const { Client } = mod;
    const { StdioClientTransport } = clientMod;
    
    console.log('🔍 Connecting...');
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['./mcp-servers/nodemailer-mcp-server.js'],
      env: process.env
    });
    
    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, { capabilities: {} });
    
    try {
      await client.connect(transport);
      console.log('✅ Connected');
      
      const tools = await client.listTools();
      console.log('✅ Tools:', tools.tools.length);
      
      console.log('🔧 Calling tool...');
      const result = await client.callTool({
        name: 'send_email',
        arguments: {
          to: ['test@example.com'],
          subject: 'Test',
          html: '<p>Test</p>'
        }
      });
      console.log('✅ Result:', result);
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });
}).catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
