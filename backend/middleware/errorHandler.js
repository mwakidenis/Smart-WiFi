// backend/middleware/errorHandler.js
// Global error handler for Smart Wifi Express API
// Follows the Comprehensive System Prompt & Engineering Specification

const { PrismaClientKnownRequestError, PrismaClientValidationError } = require('@prisma/client');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  const errorResponse = {
    error: true,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  // Prisma known request errors
  if (err instanceof PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        errorResponse.message = 'A record with this value already exists';
        errorResponse.statusCode = 409;
        break;
      case 'P2025':
        errorResponse.message = 'Record not found';
        errorResponse.statusCode = 404;
        break;
      default:
        errorResponse.message = 'Database error';
        errorResponse.statusCode = 500;
    }
  }

  // Prisma validation errors
  if (err instanceof PrismaClientValidationError) {
    errorResponse.message = 'Invalid request data';
    errorResponse.statusCode = 400;
  }

  console.error(`[${new Date().toISOString()}] ${statusCode} ${err.message}`);

  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler;
