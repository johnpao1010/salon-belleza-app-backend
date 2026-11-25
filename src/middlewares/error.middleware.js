const AppError = require('../utils/AppError');

/**
 * Handle JWT errors
 */
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

/**
 * Handle JWT expired error
 */
const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

/**
 * Handle validation errors (e.g., from Sequelize)
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handle duplicate field errors (e.g., unique constraint violation)
 */
const handleDuplicateFieldsDB = (err) => {
  const value = err.errors?.[0]?.message?.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

/**
 * Send detailed error in development environment
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

/**
 * Send simplified error in production environment
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  // http-errors (e.g. malformed or oversized JSON bodies) mark client errors with `expose`
  if (err.isOperational || (err.expose && err.statusCode < 500)) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak error details
    // Log without the error object itself: parser errors carry the raw request body
    console.error('ERROR 💥', err.name, err.message, err.stack);
    res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
    });
  }
};

/**
 * Global error handling middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    err.statusCode = 400;
    err.status = 'fail';
  }
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err, name: err.name, message: err.message, stack: err.stack };

    // Handle specific error types
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeValidationError') {
      error = handleValidationErrorDB(error);
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      error = handleDuplicateFieldsDB(error);
    }

    sendErrorProd(error, res);
  }
};

module.exports = globalErrorHandler;
