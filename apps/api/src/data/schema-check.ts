import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PoolClient } from 'pg';

/**
 * Does the live database look like the migrations say it should?
 *
 * `v2_migrations` records *that* a file was applied, not *what the schema
 * is*. When the two part company — a draft pasted into psql, a ledger row
 * edited by hand to get past the checksum guard — the runner happily
 * reports everything up to date while a column or an enum value is missing,
 * and the gap surfaces months later as a 500 in the middle of a form. That
 * happened twice (`0003`, `0005`).
 *
 * So the schema the migrations produce is kept as a reviewed file,
 * `database/schema/snapshot.txt`, and compared against the live database
 * after every `db:migrate`. The integration suite builds a database from
 * nothing and checks it still matches the snapshot, so a migration cannot be
 * added without the snapshot moving with it (`npm run db:snapshot`).
 *
 * The snapshot is one line per column, enum, constraint and index of the
 * `v2_` tables — plain text, so a drift reads as a diff.
 */

// apps/api/src/data → … → the repo root.
export const SNAPSHOT_PATH = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../database/schema/snapshot.txt'
);

const SCHEMA_QUERY = `
  SELECT 'column ' || table_name || '.' || column_name || ' ' || data_type
         || ' nullable=' || is_nullable || ' default=' || coalesce(column_default, '') AS line
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name LIKE 'v2\\_%' AND table_name <> 'v2_migrations'
  UNION ALL
  SELECT 'enum ' || t.typname || ' ' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public' AND t.typname LIKE 'v2\\_%'
   GROUP BY t.typname
  UNION ALL
  SELECT 'constraint ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
    FROM pg_constraint
   WHERE connamespace = 'public'::regnamespace
     AND conrelid::regclass::text LIKE 'v2\\_%' AND conrelid::regclass::text <> 'v2_migrations'
  UNION ALL
  SELECT 'index ' || indexname || ' ' || indexdef
    FROM pg_indexes
   WHERE schemaname = 'public' AND tablename LIKE 'v2\\_%' AND tablename <> 'v2_migrations'
`;

/** The live schema, one sorted line per object. Sorted here, not in SQL, so collation cannot reorder it. */
export async function readSchema(client: Pick<PoolClient, 'query'>): Promise<string[]> {
  const { rows } = await client.query<{ line: string }>(SCHEMA_QUERY);
  return rows.map((row) => row.line).sort();
}

export async function readSnapshot(): Promise<string[] | null> {
  try {
    const text = await readFile(SNAPSHOT_PATH, 'utf8');
    return text.split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

export async function writeSnapshot(lines: string[]): Promise<void> {
  await writeFile(SNAPSHOT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

export type SchemaDrift = {
  /** In the snapshot, not in the database: the migrations say it exists, and it does not. */
  missing: string[];
  /** In the database, not in the snapshot. */
  unexpected: string[];
};

export function diffSchema(expected: string[], actual: string[]): SchemaDrift {
  const have = new Set(actual);
  const want = new Set(expected);
  return {
    missing: expected.filter((line) => !have.has(line)),
    unexpected: actual.filter((line) => !want.has(line)),
  };
}

export function describeDrift({ missing, unexpected }: SchemaDrift): string {
  return [
    ...missing.map((line) => `  − missing:    ${line}`),
    ...unexpected.map((line) => `  + unexpected: ${line}`),
  ].join('\n');
}
