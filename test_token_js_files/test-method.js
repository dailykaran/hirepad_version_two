import('@modelcontextprotocol/sdk/server/index.js').then(async m => {
  import('@modelcontextprotocol/sdk/types.js').then(types => {
    // Try to understand the schema structure
    const schema = types.CallToolRequestSchema;
    console.log('CallToolRequestSchema.def:', schema.def);
    console.log('');
    console.log('shape keys:', Object.keys(schema.def.shape || {}));
    
    // Check the method field  
    const methodField = schema.def.shape?.method;
    if (methodField) {
      console.log('method field:', methodField);
    }
  });
}).catch(e => console.error('Error:', e.message));
