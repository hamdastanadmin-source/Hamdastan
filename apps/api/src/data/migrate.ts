import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { getPool, closePool, isDatabaseConfigured } from './pool';

/**
 * The migration runner — `npm run db:migrate`.
 *
 * `database/migrations/*.sql` is the schema. Files are applied in filename
 * order, once each, and recorded in `v2_migrations` so a second run is a
 * no-op. The rules in `RULES.md` §1 are enforced here rather than left to
 * review:
 *
 *   • Each file runs inside a transaction this runner opens, so a file that
 *     fails half-way leaves nothing behind. Files therefore contain no BEGIN
 *     or COMMIT of their own — the runner refuses one that does.
 *   • An applied file that has since been edited is refused, by checksum. A
 *     change to the schema is a new file, never an edit to an old one.
 *   • A statement that can destroy data is refused unless the file says, in
 *     a `-- allow-destructive:` comment, why it is meant to.
 *   • An advisory lock serialises runners, so two instances booting together
 *     cannot apply the same file twice.
 */

// apps/api/src/data → apps/api/src → apps/api → apps → the repo root.
const MIGRATIONS_DIR = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../database/migrations'
);

/** One 64-bit key, so every runner contends for the same lock. */
const ADVISORY_LOCK_KEY = 8_211_974_130_552_001n;

const DESTRUCTIVE_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
];

const LEDGER = `
  CREATE TABLE IF NOT EXISTS v2_migrations (
    name       text PRIMARY KEY,
    checksum   char(64) NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

export type MigrationOutcome = {
  applied: string[];
  alreadyApplied: string[];
};

function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

function assertSafe(name: string, sql: string): void {
  // Strip comments first, so the word "TRUNCATE" in a note explaining why a
  // table is *not* truncated does not trip the guard.
  const code = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  if (/\b(BEGIN|COMMIT|ROLLBACK)\b\s*;/i.test(code)) {
    throw new Error(
      `${name}: contains its own BEGIN/COMMIT. The runner opens the ` +
        `transaction — remove them so a failure cannot leave the file ` +
        `half-applied.`
    );
  }

  const declaredSafe = /--\s*allow-destructive:/i.test(sql);
  if (declaredSafe) return;

  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(code)) {
      throw new Error(
        `${name}: contains a statement that can destroy data ` +
          `(${pattern.source}). RULES.md §1 says stop and review. If it is ` +
          `genuinely intended, say so in an "-- allow-destructive: <reason>" ` +
          `comment in the file.`
      );
    }
  }
}

async function readMigrations(): Promise<{ name: string; sql: string }[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  const names = entries.filter((name) => name.endsWith('.sql')).sort();

  return Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(path.join(MIGRATIONS_DIR, name), 'utf8'),
    }))
  );
}

export async function runMigrations(
  log: (message: string) => void = () => undefined
): Promise<MigrationOutcome> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not set — nothing to migrate against.');
  }

  const files = await readMigrations();
  for (const file of files) assertSafe(file.name, file.sql);

  const client = await getPool().connect();
  const outcome: MigrationOutcome = { applied: [], alreadyApplied: [] };

  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY.toString()]);
    await client.query(LEDGER);

    const { rows } = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM v2_migrations'
    );
    const recorded = new Map(rows.map((row) => [row.name, row.checksum]));

    for (const file of files) {
      const digest = checksum(file.sql);
      const previous = recorded.get(file.name);

      if (previous) {
        if (previous !== digest) {
          throw new Error(
            `${file.name}: already applied, but the file has changed since. ` +
              `An applied migration is never edited — add a new file instead.`
          );
        }
        outcome.alreadyApplied.push(file.name);
        continue;
      }

      log(`applying ${file.name}`);

      await client.query('BEGIN');
      try {
        await client.query(file.sql);
        await client.query(
          'INSERT INTO v2_migrations (name, checksum) VALUES ($1, $2)',
          [file.name, digest]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }

      outcome.applied.push(file.name);
    }

    return outcome;
  } finally {
    await client
      .query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY.toString()])
      .catch(() => undefined);
    client.release();
  }
}

/** `npm run db:migrate` lands here. */
async function main(): Promise<void> {
  try {
    const { applied, alreadyApplied } = await runMigrations((message) =>
      console.log(`[migrate] ${message}`)
    );

    console.log(
      `[migrate] ${applied.length} applied, ${alreadyApplied.length} already up to date.`
    );
  } catch (error) {
    console.error(`[migrate] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
