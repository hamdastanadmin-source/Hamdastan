import type { AccountSettings, AvatarConfig } from '@hamdastan/config';
import type { Gender } from '@hamdastan/types';
import { USERNAME_TAKEN_MESSAGE } from '@hamdastan/validation';

import { query, queryOne } from '../../data';
import { ConflictError } from '../../shared/errors';
import { createRepositorySlot } from '../../shared/repository';

import type {
  BasicInfo,
  OnboardingStep,
  ProfileFields,
  UserRecord,
} from './users.types';

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
  /**
   * The user a live access token belongs to: the token unexpired, its session
   * neither revoked nor expired. Null otherwise.
   *
   * Whether a token is live is the Auth module's rule, but it is answered
   * here, joined to the user row, because it runs before every protected
   * request — one round trip to the database rather than two.
   */
  findByAccessToken(tokenHash: string, now: Date): Promise<UserRecord | null>;
  findByPhone(phone: string): Promise<UserRecord | null>;
  /** Whether an account other than `exceptId` holds `username` (already normalised). */
  isUsernameTaken(username: string, exceptId: string): Promise<boolean>;
  /**
   * The row a verified code creates. Returns the existing user when the
   * number already has one, so two codes verified at once cannot produce two
   * accounts — the unique index on `phone` is what decides, not a prior read.
   * Null when `username` is already held by someone else, so the caller can
   * try another.
   */
  createWithPhone(phone: string, username: string): Promise<UserRecord | null>;
  /**
   * Sets the username only where there is none, and returns the row either
   * way. Null when `username` is already held by someone else.
   */
  assignUsername(id: string, username: string): Promise<UserRecord | null>;
  saveBasicInfo(id: string, info: BasicInfo): Promise<UserRecord>;
  /** The sign-up username step: stores the name and records the step as done. Taken is a `ConflictError`. */
  confirmUsername(id: string, username: string): Promise<UserRecord>;
  setOnboardingStep(id: string, step: OnboardingStep): Promise<UserRecord>;

  // ─── The account area ────────────────────────────────────────
  /** Writes only the fields present. A username someone else holds is a `ConflictError`. */
  updateProfile(id: string, fields: ProfileFields): Promise<UserRecord>;
  saveAvatar(id: string, avatar: AvatarConfig): Promise<UserRecord>;
  saveSettings(id: string, settings: AccountSettings): Promise<UserRecord>;
}

const slot = createRepositorySlot<UsersRepository>('users');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const usersRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setUsersRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

/** The editable fields and their columns — the only names `updateProfile` writes. */
const PROFILE_COLUMNS: Record<keyof ProfileFields, string> = {
  displayName: 'display_name',
  username: 'username',
  city: 'city',
  bio: 'bio',
  instagram: 'instagram',
  telegram: 'telegram',
  linkedin: 'linkedin',
};

/** PostgreSQL's unique_violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * A username write's failure, in the domain's words. The unique index
 * decides, not a prior read: two people choosing the same name at once
 * cannot both pass.
 */
function usernameWriteError(error: unknown): unknown {
  return (error as { code?: string }).code === UNIQUE_VIOLATION
    ? new ConflictError(USERNAME_TAKEN_MESSAGE)
    : error;
}

/** `v2_gender` is upper-case; the wire contract is lower-case. */
const GENDER_TO_DB: Record<Gender, string> = {
  male: 'MALE',
  female: 'FEMALE',
};

type UserRow = {
  id: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  gender: string | null;
  display_name: string | null;
  username: string | null;
  username_confirmed: boolean;
  city: string | null;
  bio: string | null;
  instagram: string | null;
  telegram: string | null;
  linkedin: string | null;
  avatar_config: AvatarConfig | null;
  settings: Partial<AccountSettings>;
  onboarding_step: OnboardingStep;
  onboarding_stage: number;
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
  gender, display_name, username,
  username_confirmed_at IS NOT NULL AS username_confirmed,
  city, bio, instagram, telegram, linkedin,
  avatar_config, settings,
  onboarding_step, onboarding_stage, role, status
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
    username: row.username,
    usernameConfirmed: row.username_confirmed,
    city: row.city,
    bio: row.bio,
    instagram: row.instagram,
    telegram: row.telegram,
    linkedin: row.linkedin,
    avatarConfig: row.avatar_config,
    settings: row.settings,
    onboardingStep: row.onboarding_step,
    onboardingStage: row.onboarding_stage,
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

  async findByAccessToken(tokenHash, now) {
    const row = await queryOne<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM v2_users
        WHERE id = (SELECT t.user_id
                      FROM v2_access_tokens t
                      JOIN v2_sessions s ON s.id = t.session_id
                     WHERE t.token_hash = $1
                       AND t.expires_at > $2
                       AND s.revoked_at IS NULL
                       AND s.expires_at > $2
                       -- Access tokens are already capped at the session's
                       -- absolute end; this holds even if one were not.
                       AND (s.absolute_expires_at IS NULL OR s.absolute_expires_at > $2))`,
      [tokenHash, now]
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

  async isUsernameTaken(username, exceptId) {
    const row = await queryOne<{ taken: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM v2_users WHERE username = $1 AND id <> $2) AS taken`,
      [username, exceptId]
    );
    return row?.taken ?? false;
  },

  async createWithPhone(phone, username) {
    // ON CONFLICT with a no-op update rather than DO NOTHING, because
    // DO NOTHING returns no row on conflict and the caller needs the user.
    // It covers `phone` only; a clash on `username` still raises.
    try {
      const rows = await query<UserRow>(
        `INSERT INTO v2_users (phone, username)
              VALUES ($1, $2)
         ON CONFLICT (phone) DO UPDATE SET updated_at = now()
           RETURNING ${SELECT_COLUMNS}`,
        [phone, username]
      );
      return toRecord(rows[0]);
    } catch (error) {
      if ((error as { constraint?: string }).constraint === 'v2_users_username') return null;
      throw error;
    }
  },

  async assignUsername(id, username) {
    try {
      const rows = await query<UserRow>(
        `UPDATE v2_users
            SET username = COALESCE(username, $2), updated_at = now()
          WHERE id = $1
      RETURNING ${SELECT_COLUMNS}`,
        [id, username]
      );
      return toRecord(rows[0]);
    } catch (error) {
      if ((error as { constraint?: string }).constraint === 'v2_users_username') return null;
      throw error;
    }
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

  async confirmUsername(id, username) {
    // COALESCE: the first answer is the moment the step was done.
    try {
      const rows = await query<UserRow>(
        `UPDATE v2_users
            SET username              = $2,
                username_confirmed_at = COALESCE(username_confirmed_at, now()),
                updated_at            = now()
          WHERE id = $1
      RETURNING ${SELECT_COLUMNS}`,
        [id, username]
      );
      return toRecord(rows[0]);
    } catch (error) {
      throw usernameWriteError(error);
    }
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

  async updateProfile(id, fields) {
    const entries = (Object.keys(PROFILE_COLUMNS) as (keyof ProfileFields)[]).filter(
      (key) => fields[key] !== undefined
    );
    const assignments = entries.map((key, i) => `${PROFILE_COLUMNS[key]} = $${i + 2}`);

    try {
      const rows = await query<UserRow>(
        `UPDATE v2_users
            SET ${[...assignments, 'updated_at = now()'].join(', ')}
          WHERE id = $1
      RETURNING ${SELECT_COLUMNS}`,
        [id, ...entries.map((key) => fields[key])]
      );
      return toRecord(rows[0]);
    } catch (error) {
      throw usernameWriteError(error);
    }
  },

  async saveAvatar(id, avatar) {
    const rows = await query<UserRow>(
      `UPDATE v2_users SET avatar_config = $2, updated_at = now()
        WHERE id = $1
    RETURNING ${SELECT_COLUMNS}`,
      [id, JSON.stringify(avatar)]
    );
    return toRecord(rows[0]);
  },

  async saveSettings(id, settings) {
    const rows = await query<UserRow>(
      `UPDATE v2_users SET settings = $2, updated_at = now()
        WHERE id = $1
    RETURNING ${SELECT_COLUMNS}`,
      [id, JSON.stringify(settings)]
    );
    return toRecord(rows[0]);
  },
};
