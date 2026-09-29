import type { Gender } from '@hamdastan/types';

import { query, queryOne } from '../../data';
import { createRepositorySlot } from '../../shared/repository';

import type { BasicInfo, OnboardingStep, UserRecord } from './users.types';

/**
 * Data access port for the Users module, and the PostgreSQL adapter that
 * satisfies it.
 *
 * The two live in one file because this is the layer that is allowed to know
 * both vocabularies: the domain's on the way in (`findByPhone`) and SQL's on
 * the way out. Keeping the interface here rather than beside the service is
 * what lets `server.ts` swap the adapter without a service noticing.
 */
export interface UsersRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByPhone(phone: string): Promise<UserRecord | null>;
  /**
   * The row a verified code creates. Returns the existing user when the
   * number already has one, so two codes verified at once cannot produce two
   * accounts — the unique index on `phone` is what decides, not a prior read.
   */
  createWithPhone(phone: string): Promise<UserRecord>;
  saveBasicInfo(id: string, info: BasicInfo): Promise<UserRecord>;
  setOnboardingStep(id: string, step: OnboardingStep): Promise<UserRecord>;
}

const slot = createRepositorySlot<UsersRepository>('users');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const usersRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setUsersRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

/** `v2_gender` is upper-case; the wire contract is lower-case. */
const GENDER_TO_DB: Record<Gender, string> = {
  male: 'MALE',
  female: 'FEMALE',
  other: 'OTHER',
};

type UserRow = {
  id: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  gender: string | null;
  display_name: string | null;
  onboarding_step: OnboardingStep;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
};

/**
 * `birth_date` is read through `to_char` rather than as a `date`: node-postgres
 * turns a bare `date` into a JS `Date` at midnight in the *server's* zone,
 * which moves a Tehran birthday across a day boundary on a UTC host.
 */
const SELECT_COLUMNS = `
  id, phone, first_name, last_name,
  to_char(birth_date, 'YYYY-MM-DD') AS birth_date,
  gender, display_name, onboarding_step, role, status
`;

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date,
    gender: row.gender ? (row.gender.toLowerCase() as Gender) : null,
    displayName: row.display_name,
    onboardingStep: row.onboarding_step,
    role: row.role,
    status: row.status,
  };
}

export const sqlUsersRepository: UsersRepository = {
  async findById(id) {
    const row = await queryOne<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM v2_users WHERE id = $1`,
      [id]
    );
    return row ? toRecord(row) : null;
  },

  async findByPhone(phone) {
    const row = await queryOne<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM v2_users WHERE phone = $1`,
      [phone]
    );
    return row ? toRecord(row) : null;
  },

  async createWithPhone(phone) {
    // ON CONFLICT with a no-op update rather than DO NOTHING, because
    // DO NOTHING returns no row on conflict and the caller needs the user.
    const rows = await query<UserRow>(
      `INSERT INTO v2_users (phone)
            VALUES ($1)
       ON CONFLICT (phone) DO UPDATE SET updated_at = now()
         RETURNING ${SELECT_COLUMNS}`,
      [phone]
    );
    return toRecord(rows[0]);
  },

  async saveBasicInfo(id, info) {
    // `display_name` is seeded from the first name and then belongs to the
    // user, so COALESCE leaves a name they have already chosen alone.
    const rows = await query<UserRow>(
      `UPDATE v2_users
          SET first_name      = $2,
              last_name       = $3,
              birth_date      = $4::date,
              gender          = $5::v2_gender,
              display_name    = COALESCE(display_name, $2),
              onboarding_step = CASE WHEN onboarding_step = 'basic_info'
                                     THEN 'onboarding'::v2_onboarding_step
                                     ELSE onboarding_step END,
              updated_at      = now()
        WHERE id = $1
    RETURNING ${SELECT_COLUMNS}`,
      [id, info.firstName, info.lastName, info.birthDate, GENDER_TO_DB[info.gender]]
    );
    return toRecord(rows[0]);
  },

  async setOnboardingStep(id, step) {
    const rows = await query<UserRow>(
      `UPDATE v2_users
          SET onboarding_step = $2::v2_onboarding_step, updated_at = now()
        WHERE id = $1
    RETURNING ${SELECT_COLUMNS}`,
      [id, step]
    );
    return toRecord(rows[0]);
  },
};
