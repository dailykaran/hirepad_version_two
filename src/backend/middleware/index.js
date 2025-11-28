import fileUpload from 'express-fileupload';

/**
 * Middleware for handling audio file uploads
 */
export function audioUploadMiddleware() {
  return fileUpload({
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
    safeFileNames: true,
    preserveExtension: true,
  });
}

/**
 * Error handling middleware
 */
export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: {
      status,
      message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
}

/**
 * Session management middleware
 */
export function sessionMiddleware(req, res, next) {
  // Generate or retrieve session ID
  if (!req.session) {
    req.session = {};
  }

  if (!req.sessionID) {
    req.sessionID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Store session ID in response headers
  res.setHeader('X-Session-ID', req.sessionID);

  next();
}

/**
 * Input validation middleware
 */
export function validateInput(schema) {
  return (req, res, next) => {
    try {
      // Basic validation - can be extended with joi/yup
      if (!req.body) {
        return res.status(400).json({
          error: { message: 'Request body is required' },
        });
      }
      next();
    } catch (error) {
      res.status(400).json({
        error: { message: 'Invalid input', details: error.message },
      });
    }
  };
}
