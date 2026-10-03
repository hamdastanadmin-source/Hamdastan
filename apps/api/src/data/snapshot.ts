/**
 * `npm run db:snapshot` — rebuilds `database/schema/snapshot.txt` from the
 * migrations alone.
 *
 * It resets the schema of `TEST_DATABASE_URL`, applies every migration to the
 * empty database and writes down what that produced. It never touches
 * `DATABASE_URL`: the snapshot must describe what the files build, not what
 * some live database happens to look like. Run it after adding a migration
 * and commit the snapshot with it — the integration suite fails until you do.
 */

const snapshotDatabaseUrl = process.env.TEST_DATABASE_URL ?? '';
const name = snapshotDatabaseUrl ? new URL(snapshotDatabaseUrl).pathname.replace(/^\//, '') : '';

if (!name.endsWith('_test')) {
  console.error(
    '[snapshot] TEST_DATABASE_URL must name a database ending in "_test" — its schema is reset. ' +
      'e.g. postgresql://localhost/hamdastan_test'
  );
  process.exit(1);
}

// Before anything reads the environment: the pool must open on the test database.
process.env.DATABASE_URL = snapshotDatabaseUrl;

const { closePool, getPool, readSchema, runMigrations } = await import('./index');
const { writeSnapshot, SNAPSHOT_PATH } = await import('./schema-check');

try {
  await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const { applied } = await runMigrations();
  const lines = await readSchema(getPool());
  await writeSnapshot(lines);
  console.log(`[snapshot] ${applied.length} migrations → ${lines.length} lines in ${SNAPSHOT_PATH}`);
} catch (error) {
  console.error(`[snapshot] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await closePool();
}

// A module, so the top-level awaits above are allowed.
export {};
