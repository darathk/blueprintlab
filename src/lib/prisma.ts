import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// In serverless environments each function instance must hold at most 1 DB
// connection. We enforce this here regardless of what the DATABASE_URL contains.
function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || '';
  if (!url) return url;
  // Remove existing limit and timeout params
  let cleaned = url.replace(/[?&]connection_limit=\d+/g, '');
  cleaned = cleaned.replace(/[?&]pool_timeout=\d+/g, '');
  const separator = cleaned.includes('?') ? '&' : '?';
  
  // connection_limit=1 keeps Supabase Session pool alive across lambdas
  // pool_timeout=0 prevents Prisma from timing out when parallel queries queue up on the 1 connection
  return `${cleaned}${separator}connection_limit=1&pool_timeout=0`;
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
