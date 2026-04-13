import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// In serverless environments each function instance must hold at most 1 DB
// connection. We enforce this here regardless of what the DATABASE_URL contains.
function getDatabaseUrl() {
  let url = process.env.DATABASE_URL || '';
  if (!url) return url;
  
  // Convert Supabase session port (5432) to transaction port (6543) for serverless
  if ((url.includes('supabase.co') || url.includes('pooler.supabase.com')) && url.includes(':5432')) {
    url = url.replace(':5432', ':6543');
  }

  // Remove existing conflicting params
  let cleaned = url.replace(/[?&]connection_limit=\d+/g, '');
  cleaned = cleaned.replace(/[?&]pool_timeout=\d+/g, '');
  cleaned = cleaned.replace(/[?&]pgbouncer=\w+/g, '');
  
  const separator = cleaned.includes('?') ? '&' : '?';
  
  // pgbouncer=true is REQUIRED for transaction pooling (port 6543)
  // connection_limit=1 keeps each lambda strict
  // pool_timeout=0 prevents queries from timing out locally within the lambda
  return `${cleaned}${separator}pgbouncer=true&connection_limit=1&pool_timeout=0`;
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
