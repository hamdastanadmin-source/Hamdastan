import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

const globalForPrisma = globalThis as unknown as {
  prismaGlobal: PrismaClient | undefined;
};

const LOG_LEVELS: Array<'query' | 'info' | 'warn' | 'error'> =
  process.env.PRISMA_LOG_QUERIES === 'true'
    ? ['query', 'warn', 'error']
    : ['warn', 'error'];

export const prisma =
  globalForPrisma.prismaGlobal ??
  new PrismaClient({
    log: LOG_LEVELS,
    // Connection pool is configured via DATABASE_URL query params:
    //   ?connection_limit=10&pool_timeout=30&connect_timeout=10
    // Defaults: connection_limit = num_cpus * 2 + 1, pool_timeout = 10s
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaGlobal = prisma;
}

/**
 * Pre-warm the connection pool so the first user request doesn't pay
 * the SSL-handshake + TCP-connect cost (~500ms–2s for remote Supabase).
 *
 * Called once at module-load time; subsequent imports are no-ops
 * because the singleton is already connected.
 */
const warmupPromise = prisma
  .$connect()
  .then(() => {
    logger.info('Prisma connection pool pre-warmed');
  })
  .catch((err) => {
    // Non-fatal: the pool will lazy-connect on first query.
    logger.warn({ err }, 'Prisma pool pre-warm failed (will retry on first query)');
  });

/** Await this if you need to guarantee the pool is ready (e.g. in health checks). */
export const ensureConnected = () => warmupPromise;

export default prisma;
