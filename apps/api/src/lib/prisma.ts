import { PrismaClient } from '@prisma/client';

// Singleton pattern — one shared connection pool for the entire app.
// connection_limit=5 caps PostgreSQL connections for this service (server shares DB with other apps).
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: (process.env.DATABASE_URL || '') + (process.env.DATABASE_URL?.includes('?') ? '&' : '?') + 'connection_limit=5&pool_timeout=10',
    },
  },
});

export default prisma;
