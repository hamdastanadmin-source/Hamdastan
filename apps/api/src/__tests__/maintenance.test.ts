import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closePool, getPool, runMigrations } from '../data';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, sqlAuthRepository } from '../modules/auth';
import { maintenanceService, setMaintenanceRepository, sqlMaintenanceRepository } from '../modules/maintenance';

/**
 * The cleanup job against a real PostgreSQL: it deletes what can never be
 * used again, keeps what still holds value or is inside its retention, and
 * never runs twice at once.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)('maintenance', () => {
  let userId: string;
  let adminId: string;

  const exists = async (sql: string, params: unknown[]) =>
    (await getPool().query(sql, params)).rowCount === 1;

  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setMaintenanceRepository(sqlMaintenanceRepository);

    const pool = getPool();
    userId = (await pool.query(`INSERT INTO v2_users (phone) VALUES ('09990000777') RETURNING id`)).rows[0].id;
    adminId = (await pool.query(`SELECT id FROM v2_admin_users LIMIT 1`)).rows[0].id;

    // Sessions: live; ended yesterday; ended long ago (revoked, and expired).
    await pool.query(
      `INSERT INTO v2_sessions (id, user_id, expires_at, absolute_expires_at, revoked_at) VALUES
         ('00000000-0000-4000-8000-000000000001', $1, now() + interval '7 days', now() + interval '30 days', NULL),
         ('00000000-0000-4000-8000-000000000002', $1, now() + interval '7 days', NULL, now() - interval '1 day'),
         ('00000000-0000-4000-8000-000000000003', $1, now() + interval '7 days', NULL, now() - interval '100 days'),
         ('00000000-0000-4000-8000-000000000004', $1, now() - interval '100 days', NULL, NULL)`,
      [userId]
    );
    await pool.query(
      `INSERT INTO v2_access_tokens (token_hash, session_id, user_id, expires_at) VALUES
         (repeat('a', 64), '00000000-0000-4000-8000-000000000001', $1, now() - interval '1 hour'),
         (repeat('b', 64), '00000000-0000-4000-8000-000000000001', $1, now() + interval '10 minutes')`,
      [userId]
    );
    await pool.query(
      `INSERT INTO v2_refresh_tokens (token_hash, session_id, user_id, expires_at, used_at) VALUES
         (repeat('c', 64), '00000000-0000-4000-8000-000000000001', $1, now() - interval '1 hour', now() - interval '2 hours'),
         (repeat('d', 64), '00000000-0000-4000-8000-000000000001', $1, now() + interval '7 days', NULL)`,
      [userId]
    );
    await pool.query(
      `INSERT INTO v2_otp_sends (phone, ip, sent_at) VALUES
         ('09990000777', '203.0.113.1', now() - interval '40 days'),
         ('09990000777', '203.0.113.1', now() - interval '1 day')`
    );
    await pool.query(
      `INSERT INTO v2_otp_failures (phone, failures, window_started_at) VALUES
         ('09990000777', 5, now() - interval '3 days'),
         ('09990000778', 2, now() - interval '5 minutes')`
    );
    await pool.query(
      `INSERT INTO v2_idempotency_keys (scope, owner_id, idem_key, request_hash, outcome, expires_at) VALUES
         ('test', $1, 'expired-key-0000000', repeat('e', 64), '{}', now() - interval '1 day'),
         ('test', $1, 'live-key-000000000', repeat('f', 64), '{}', now() + interval '1 day')`,
      [userId]
    );
    await pool.query(
      `INSERT INTO v2_admin_sessions (token_hash, admin_id, expires_at, revoked_at, last_seen_at) VALUES
         (repeat('1', 64), $1, now() - interval '100 days', NULL, now() - interval '100 days'),
         (repeat('2', 64), $1, now() + interval '10 hours', NULL, now())`,
      [adminId]
    );
  });

  afterAll(async () => {
    await closePool();
  });

  it('skips the run while another instance holds the lock', async () => {
    const holder = await getPool().connect();
    try {
      await holder.query('SELECT pg_advisory_lock($1)', [0x6864_6d6e]);
      expect(await maintenanceService.runOnce()).toBeNull();
    } finally {
      await holder.query('SELECT pg_advisory_unlock($1)', [0x6864_6d6e]);
      holder.release();
    }
  });

  it('deletes only what can never be used again, and reports it per table', async () => {
    const report = await maintenanceService.runOnce();
    expect(report).not.toBeNull();
    expect(report!.counts).toMatchObject({
      access_tokens: 1,
      sessions: 2,
      otp_sends: 1,
      otp_failures: 1,
      idempotency_keys: 1,
      admin_sessions: 1,
    });
    // The expired refresh token is gone; the live one stays.
    expect(report!.counts.refresh_tokens).toBe(1);

    // Kept: the live session and its live tokens, a session ended yesterday
    // (inside the retention), recent sends, a live failure window and key.
    expect(await exists(`SELECT 1 FROM v2_sessions WHERE id = '00000000-0000-4000-8000-000000000001'`, [])).toBe(true);
    expect(await exists(`SELECT 1 FROM v2_sessions WHERE id = '00000000-0000-4000-8000-000000000002'`, [])).toBe(true);
    expect(await exists(`SELECT 1 FROM v2_access_tokens WHERE token_hash = repeat('b', 64)`, [])).toBe(true);
    expect(await exists(`SELECT 1 FROM v2_refresh_tokens WHERE token_hash = repeat('d', 64)`, [])).toBe(true);
    expect(await exists(`SELECT 1 FROM v2_otp_failures WHERE phone = '09990000778'`, [])).toBe(true);
    expect(await exists(`SELECT 1 FROM v2_idempotency_keys WHERE idem_key = 'live-key-000000000'`, [])).toBe(true);
    expect(await exists(`SELECT 1 FROM v2_admin_sessions WHERE token_hash = repeat('2', 64)`, [])).toBe(true);
    // Never touched: the account itself.
    expect(await exists(`SELECT 1 FROM v2_users WHERE id = $1`, [userId])).toBe(true);
  });

  it('is a no-op the second time', async () => {
    const report = await maintenanceService.runOnce();
    expect(Object.values(report!.counts).every((n) => n === 0)).toBe(true);
  });
});

// Without a database the suite above is skipped; this says why. Registered
// only then, so a run that has the database reports no skipped test.
if (!hasDatabase) {
  describe('maintenance', () => {
    it.skip('needs TEST_DATABASE_URL', () => {});
  });
}
