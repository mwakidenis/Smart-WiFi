// backend/config/env.js
// Environment validation for Smart Wifi
// Validates all required environment variables at startup
// Follows the Comprehensive System Prompt & Engineering Specification

const requiredEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_PASSKEY',
  'MPESA_SHORTCODE',
  'MPESA_CALLBACK_URL',
];

const optionalEnv = [
  'MIKROTIK_HOST',
  'MIKROTIK_PORT',
  'MIKROTIK_USERNAME',
  'MIKROTIK_PASSWORD',
  'NODE_ENV',
  'PORT',
  'FRONTEND_URL',
];

function validateEnv() {
  const missing = [];

  for (const key of requiredEnv) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(
      '[env] Missing required environment variables:\n  - ' +
      missing.join('\n  - ') +
      '\n\nPlease copy .env.example to .env and fill in all values.'
    );
    process.exit(1);
  }

  console.log('[env] All required environment variables present');
  console.log('[env] Environment:', process.env.NODE_ENV || 'development');
  console.log('[env] MPESA Environment:', process.env.MPESA_ENVIRONMENT || 'sandbox');
}

module.exports = { validateEnv, requiredEnv, optionalEnv };
