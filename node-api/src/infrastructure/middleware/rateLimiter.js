const rateLimit = require('express-rate-limit');

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiting for upload endpoints
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 upload requests per windowMs
  message: {
    error: 'Too many upload requests',
    message: 'Too many file uploads from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict rate limiting for AI processing endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each IP to 50 AI requests per hour
  message: {
    error: 'Too many AI requests',
    message: 'Too many AI processing requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  uploadLimiter,
  aiLimiter
};
