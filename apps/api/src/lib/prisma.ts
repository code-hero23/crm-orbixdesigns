import { PrismaClient } from '@prisma/client';

// Singleton pattern — one shared connection pool for the entire app.
// This prevents "too many database connections" on PostgreSQL.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export default prisma;
