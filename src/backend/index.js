// Load environment variables FIRST before anything else
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../.env');
console.log('📁 Loading .env from:', envPath);
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.error('❌ Error loading .env:', envResult.error.message);
} else {
  console.log('✅ .env loaded successfully');
  console.log('   GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID ? '✅ Set' : '❌ Not set');
  console.log('   GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set');
}

// Now import everything else
import express from 'express';
import cors from 'cors';
import { audioUploadMiddleware, errorHandler, sessionMiddleware } from './middleware/index.js';
import apiRoutes from './routes/index.js';
// Use MCP service with updated SDK v1.23.0
import { initializeMCPClient, closeMCPClient } from './services/mcpEmailService.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.resolve(__dirname, '../../uploads');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads directory:', uploadsDir);
  }
} catch (err) {
  console.warn('⚠️  Could not create uploads directory:', err.message);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(audioUploadMiddleware());
app.use(sessionMiddleware);

// Serve uploaded audio files as static content
app.use('/uploads', express.static(uploadsDir));

// Initialize MCP client on startup
try {
  await initializeMCPClient();
} catch (error) {
  console.warn('MCP initialization warning:', error.message);
}

// API Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      emailProvider: process.env.EMAIL_PROVIDER,
    },
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      status: 404,
      message: 'Endpoint not found',
    },
  });
});

// Start server with automatic port fallback on EADDRINUSE
async function startServerWithFallback(startPort, maxAttempts = 5) {
  let port = Number(startPort) || 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const server = app.listen(port);

      // Wait for the 'listening' event to ensure the port was bound
      await new Promise((resolve, reject) => {
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };

        const onError = (err) => {
          server.off('listening', onListening);
          reject(err);
        };

        server.once('listening', onListening);
        server.once('error', onError);
      });

      console.log(`🚀 Backend server running on http://localhost:${port}`);
      console.log(`📧 Email Provider: ${process.env.EMAIL_PROVIDER || 'not configured'}`);

      // Graceful error handling for other runtime server errors
      server.on('error', (err) => {
        console.error('❌ Server runtime error:', err && err.message ? err.message : err);
      });

      return server;
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') {
        console.warn(`⚠️  Port ${port} is in use, trying port ${port + 1}...`);
        port += 1; // try next port
        continue;
      }

      console.error('❌ Failed to start server:', err && err.message ? err.message : err);
      process.exit(1);
    }
  }

  console.error(`❌ Unable to bind to a port after ${maxAttempts} attempts. Exiting.`);
  process.exit(1);
}

// Start the server (top-level await allowed in this module)
await startServerWithFallback(PORT, 6);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await closeMCPClient();
  process.exit(0);
});
