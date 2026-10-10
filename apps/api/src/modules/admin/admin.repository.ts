import type { AdminRole, AdminUserStatus } from '@hamdastan/types';

import { deleteInBatches, query, queryOne, withTransaction } from '../../data';
import { AppError } from '../../shared/errors';
import { createRepositorySlot } from '../../shared/repository';

import type { AdminFields, AdminListQuery, AdminRecord } from './admin.types';

/**
 * Data access port for the Admin module, and the PostgreSQL adapter that
 * satisfies it: the admin allow-list (`v2_admin_users`) and the panel's
 * sessions (`v2_admin_sessions`). The product's users and sessions are not
 * touched here.
 */
export interface AdminRepository {
  findByPhone(phone: string): Promise<AdminRecord | null>;
  findById(id: string): Promise<AdminRecord | null>;
  /** The admin behind a live, unrevoked session token. Status is the caller's call. */
  /**
   * The admin a live session belongs to. Live means not revoked, inside its
   * twelve hours, and used within the last `idleSeconds`; reading it counts
   * as use (recorded at most once a minute, to spare a write per request).
   */
  findBySessionToken(tokenHash: string, now: Date, idleSeconds: number): Promise<AdminRecord | null>;
  list(query: AdminListQuery): Promise<{ items: AdminRecord[]; total: number }>;
  /** A phone number another admin holds is `ADMIN_PHONE_TAKEN`. */
  create(fields: AdminFields): Promise<AdminRecord>;
  /**
   * Writes only the fields present. Setting `inactive` also revokes every
   * session the admin holds, in the same transaction — there is no moment
   * at which they are inactive and still signed in.
   */
  update(id: string, fields: Partial<AdminFields>): Promise<AdminRecord | null>;
  /** Removes the admin; their sessions go with them (`ON DELETE CASCADE`). False if there was none. */
  delete(id: string): Promise<boolean>;

  // ─── Sessions ────────────────────────────────────────────────
  /** Opens a session and stamps `last_login_at`, in one transaction. */
  createSession(adminId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  revokeSession(tokenHash: string): Promise<void>;
  /** Deletes sessions that ended more than `retentionDays` ago. Answers how many. */
  purgeEnded(now: Date, retentionDays: number): Promise<number>;
}

const slot = createRepositorySlot<AdminRepository>('admin');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const adminRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setAdminRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

/** PostgreSQL's unique_violation. */
const UNIQUE_VIOLATION = '23505';

/** `v2_admin_status` is upper-case; the wire contract is lower-case. */
const STATUS_TO_DB: Record<AdminUserStatus, string> = {
  active: 'ACTIVE',
  inactive: 'INACTIVE',
};

/** `v2_admin_role` is upper-case too. */
const ROLE_TO_DB: Record<AdminRole, string> = {
  system_admin: 'SYSTEM_ADMIN',
  content_manager: 'CONTENT_MANAGER',
  mission_reviewer: 'MISSION_REVIEWER',
};
const ROLE_FROM_DB = Object.fromEntries(
  Object.entries(ROLE_TO_DB).map(([role, db]) => [db, role])
) as Record<string, AdminRole>;

/** The editable fields and their columns — the only names `update` writes. */
const FIELD_COLUMNS: Record<keyof AdminFields, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  phone: 'phone',
  status: 'status',
  role: 'role',
};

type AdminRow = {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  status: 'ACTIVE' | 'INACTIVE';
  role: string;
  last_login_at: Date | null;
  created_at: Date;
};

const SELECT_COLUMNS = `id, phone, first_name, last_name, status, role, last_login_at, created_at`;

function toRecord(row: AdminRow): AdminRecord {
  return {
    id: row.id,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    status: row.status === 'ACTIVE' ? 'active' : 'inactive',
    role: ROLE_FROM_DB[row.role],
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

function toDbValue(key: keyof AdminFields, value: string): string {
  if (key === 'status') return STATUS_TO_DB[value as AdminUserStatus];
  if (key === 'role') return ROLE_TO_DB[value as AdminRole];
  return value;
}

/** The unique index decides, not a prior read: two admins adding one number at once cannot both pass. */
function rethrowPhoneTaken(error: unknown): never {
  if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
    throw new AppError(409, 'ADMIN_PHONE_TAKEN', 'این شماره قبلاً برای کاربر دیگه‌ای ثبت شده');
  }
  throw error;
}

/** `%` and `_` in a search are literal characters, not wildcards. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export const sqlAdminRepository: AdminRepository = {
  async findByPhone(phone) {
    const row = await queryOne<AdminRow>(
      `SELECT ${SELECT_COLUMNS} FROM v2_admin_users WHERE phone = $1`,
      [phone]
    );
    return row ? toRecord(row) : null;
  },

  async findById(id) {
    const row = await queryOne<AdminRow>(
      `SELECT ${SELECT_COLUMNS} FROM v2_admin_users WHERE id = $1`,
      [id]
    );
    return row ? toRecord(row) : null;
  },

  async findBySessionToken(tokenHash, now, idleSeconds) {
    const row = await queryOne<AdminRow>(
      `SELECT ${SELECT_COLUMNS} FROM v2_admin_users
        WHERE id = (SELECT admin_id FROM v2_admin_sessions
                     WHERE token_hash = $1
                       AND revoked_at IS NULL
                       AND expires_at > $2
                       AND last_seen_at > $2::timestamptz - make_interval(secs => $3))`,
      [tokenHash, now, idleSeconds]
    );
    if (!row) return null;
    await query(
      `UPDATE v2_admin_sessions SET last_seen_at = $2
        WHERE token_hash = $1 AND last_seen_at < $2::timestamptz - interval '1 minute'`,
      [tokenHash, now]
    );
    return toRecord(row);
  },

  async list({ search, page, pageSize }) {
    const pattern = search ? `%${escapeLike(search)}%` : null;
    const where = `WHERE $1::text IS NULL
                      OR first_name || ' ' || last_name ILIKE $1
                      OR phone LIKE $1`;

    const [rows, count] = await Promise.all([
      query<AdminRow>(
        `SELECT ${SELECT_COLUMNS} FROM v2_admin_users ${where}
          ORDER BY created_at DESC, id
          LIMIT $2 OFFSET $3`,
        [pattern, pageSize, (page - 1) * pageSize]
      ),
      queryOne<{ total: string }>(
        `SELECT count(*)::text AS total FROM v2_admin_users ${where}`,
        [pattern]
      ),
    ]);
    return { items: rows.map(toRecord), total: Number(count?.total ?? 0) };
  },

  async create(fields) {
    try {
      const rows = await query<AdminRow>(
        `INSERT INTO v2_admin_users (first_name, last_name, phone, status, role)
         VALUES ($1, $2, $3, $4::v2_admin_status, $5::v2_admin_role)
         RETURNING ${SELECT_COLUMNS}`,
        [fields.firstName, fields.lastName, fields.phone, STATUS_TO_DB[fields.status], ROLE_TO_DB[fields.role]]
      );
      return toRecord(rows[0]);
    } catch (error) {
      rethrowPhoneTaken(error);
    }
  },

  async update(id, fields) {
    const keys = (Object.keys(FIELD_COLUMNS) as (keyof AdminFields)[]).filter(
      (key) => fields[key] !== undefined
    );
    const assignments = keys.map((key, i) =>
      key === 'status'
        ? `status = $${i + 2}::v2_admin_status`
        : key === 'role'
          ? `role = $${i + 2}::v2_admin_role`
          : `${FIELD_COLUMNS[key]} = $${i + 2}`
    );

    try {
      return await withTransaction(async (client) => {
        const { rows } = await client.query<AdminRow>(
          `UPDATE v2_admin_users
              SET ${[...assignments, 'updated_at = now()'].join(', ')}
            WHERE id = $1
        RETURNING ${SELECT_COLUMNS}`,
          [id, ...keys.map((key) => toDbValue(key, fields[key]!))]
        );
        if (!rows[0]) return null;

        if (fields.status === 'inactive') {
          await client.query(
            `UPDATE v2_admin_sessions SET revoked_at = now()
              WHERE admin_id = $1 AND revoked_at IS NULL`,
            [id]
          );
        }
        return toRecord(rows[0]);
      });
    } catch (error) {
      rethrowPhoneTaken(error);
    }
  },

  async delete(id) {
    const rows = await query<{ id: string }>(
      `DELETE FROM v2_admin_users WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows.length > 0;
  },

  async createSession(adminId, tokenHash, expiresAt) {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO v2_admin_sessions (token_hash, admin_id, expires_at) VALUES ($1, $2, $3)`,
        [tokenHash, adminId, expiresAt]
      );
      await client.query(
        `UPDATE v2_admin_users SET last_login_at = now() WHERE id = $1`,
        [adminId]
      );
    });
  },

  async revokeSession(tokenHash) {
    await query(
      `UPDATE v2_admin_sessions SET revoked_at = now()
        WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
  },

  async purgeEnded(now, retentionDays) {
    // Ended: revoked, past its twelve hours — or idle, which is only ever
    // decided at read time, so a session idle that long is ended too.
    return deleteInBatches(
      'v2_admin_sessions',
      `COALESCE(revoked_at, LEAST(expires_at, last_seen_at)) < $1::timestamptz - make_interval(secs => $2)`,
      [now, retentionDays * 24 * 60 * 60]
    );
  },
};
