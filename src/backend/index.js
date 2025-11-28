// Load environment variables FIRST before anything else
import path from 'path';
import { fileURLToPath } from 'url';
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
import { initializeMCPClient, closeMCPClient } from './services/mcpEmailService.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(audioUploadMiddleware());
app.use(sessionMiddleware);

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📧 Email Provider: ${process.env.EMAIL_PROVIDER || 'not configured'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await closeMCPClient();
  process.exit(0);
});
