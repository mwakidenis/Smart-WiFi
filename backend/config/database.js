// backend/config/database.js
// Prisma database connection for Smart Wifi
// Follows the Comprehensive System Prompt & Engineering Specification

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

prisma
  .$connect()
  .then(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[database] Connected to PostgreSQL');
    }
  })
  .catch((err) => {
    console.error('[database] Connection failed:', err.message);
    process.exit(1);
  });

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
