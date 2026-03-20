import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Append connection_limit to avoid exhausting PgBouncer session-mode pool
function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || '';
  if (url && !url.includes('connection_limit=')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}connection_limit=1`;
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

globalForPrisma.prisma = prisma;

export default prisma;
