import('@modelcontextprotocol/sdk/types.js').then(m => {
  console.log('CallToolRequestSchema:', m.CallToolRequestSchema);
  console.log('');
  console.log('ListToolsRequestSchema:', m.ListToolsRequestSchema);
  console.log('');
  console.log('Are they ZodSchema objects?');
  console.log('CallToolRequestSchema is:', Object.getOwnPropertyNames(m.CallToolRequestSchema).slice(0, 10));
}).catch(e => console.error('Error:', e.message));
