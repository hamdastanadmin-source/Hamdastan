import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import { env } from '../config';

/**
 * The PostgreSQL connection pool — the one place in the monorepo that speaks
 * to a database.
 *
 * Nothing above a repository imports this file. A service asks its repository
 * port for domain-shaped data; the repository is the only layer allowed to
 * turn that into SQL, and the only layer allowed to call `query` below. That
 * boundary is what `docs/ARCHITECTURE.md` §4 calls the data-layer seam, and it
 * is why swapping `pg` for something else would touch this directory and no
 * other.
 *
 * The pool is created on first use rather than at import time, so a process
 * that never touches storage — a unit test building the app with
 * `buildApp()` — never opens a socket.
 */

let pool: Pool | null = null;

/** Whether a connection string was supplied. False on a fresh checkout. */
export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}

export function getPool(): Pool {
  if (pool) return pool;

  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. The API cannot reach a database — see database/README.md.'
    );
  }

  pool = new Pool({
    connectionString: env.DATABASE_URL,
    // The managed instance this project points at does not offer TLS, so the
    // default is off and the flag exists for the day it does. See the warning
    // beside DATABASE_SSL in .env.example.
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    max: env.DATABASE_POOL_MAX,
    connectionTimeoutMillis: env.DATABASE_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
    // The database is across a network, where opening a connection costs
    // several round trips (TCP, then SCRAM). TCP keepalive stops a firewall
    // or NAT silently dropping a pooled connection while it sits idle, so a
    // kept connection is still usable when the next request reaches for it.
    keepAlive: true,
    application_name: 'hamdastan-api',
  });

  // A backend can die between checkouts — a restart on the provider's side,
  // an idle connection reaped by a proxy. Without a listener that surfaces as
  // an unhandled 'error' event and takes the process down with it.
  pool.on('error', (error) => {
    console.error('[db] idle client error:', error.message);
  });

  return pool;
}

/**
 * Runs one statement. Parameters are always bound, never interpolated — a
 * repository that builds SQL by concatenation is the bug this signature
 * exists to make awkward.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as unknown[]);
  return result.rows;
}

/** The single row a query is expected to return, or null. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Runs `fn` inside a transaction, committing on return and rolling back on
 * throw. Every statement must go through the client passed in — using the
 * pool inside the callback checks out a *second* connection, which is outside
 * the transaction and will deadlock against it.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Round-trips a trivial statement. Used by the boot check and `/health`. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Drains the pool on shutdown so in-flight statements finish first. */
export async function closePool(): Promise<void> {
  if (!pool) return;
  const closing = pool;
  pool = null;
  await closing.end();
}
