const errorHandler = (err, req, res, _next) => {
  // Log error
  console.error(`Error ${err.status || 500}: ${err.message}`);
  console.error(err.stack);

  // Default error
  let error = {
    status: err.status || 500,
    message: err.message || 'Internal Server Error'
  };

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error = {
      status: 400,
      message: 'Validation Error',
      errors: messages
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = {
      status: 400,
      message: `Duplicate value for ${field}`,
      field: field
    };
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    error = {
      status: 400,
      message: 'Invalid ID format'
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      status: 401,
      message: 'Invalid token'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      status: 401,
      message: 'Token expired'
    };
  }

  // Send response
  res.status(error.status).json({
    success: false,
    error: {
      message: error.message,
      ...(error.errors && { errors: error.errors }),
      ...(error.field && { field: error.field }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;
