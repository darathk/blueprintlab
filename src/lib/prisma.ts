import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// In serverless environments each function instance must hold at most 1 DB
// connection. We enforce this here regardless of what the DATABASE_URL contains.
function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || '';
  if (!url) return url;
  // Remove any existing connection_limit param and replace with 1
  const cleaned = url.replace(/[?&]connection_limit=\d+/g, '');
  const separator = cleaned.includes('?') ? '&' : '?';
  return `${cleaned}${separator}connection_limit=1`;
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

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
