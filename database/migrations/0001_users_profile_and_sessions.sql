-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 — the product's users, their one-time codes, and their sessions
--
-- Applied by `npm run db:migrate` (apps/api/src/data/migrate.ts), which opens
-- the transaction and records this file in `v2_migrations`. It therefore has
-- no BEGIN/COMMIT of its own, and — once applied — is never edited: the
-- runner checksums it and refuses a file that has changed. A schema change is
-- a new file.
--
-- PostgreSQL. New tables take the `v2_` prefix, per RULES.md §2.
-- ═══════════════════════════════════════════════════════════════════════════

-- 'OTHER' is a first-class answer on the sign-up form, not an absence of
-- one: a null gender means the form has not been filled in yet.
CREATE TYPE v2_gender AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE v2_onboarding_step AS ENUM ('basic_info', 'onboarding', 'done');
CREATE TYPE v2_user_status AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE v2_user_role AS ENUM ('USER', 'ADMIN');

-- ─── Users ──────────────────────────────────────────────────────────────────
-- A row exists from the moment a one-time code verifies, which is *before*
-- the product knows anything about the person. Every profile column is
-- therefore nullable, and `onboarding_step` is what says so — an empty
-- profile is a legitimate state of a real account, not a half-written row.
CREATE TABLE v2_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Normalised to 09xxxxxxxxx by @hamdastan/validation before it ever
  -- reaches here, which is what makes this unique index meaningful: one
  -- person cannot get two accounts by typing +98 912… one day and 0912…
  -- the next.
  phone           varchar(11) NOT NULL UNIQUE,
  first_name      varchar(30),
  last_name       varchar(40),
  birth_date      date,
  gender          v2_gender,
  -- What the product calls them. Defaults to the first name on the
  -- basic-info form and is theirs to change after.
  display_name    varchar(60),
  onboarding_step v2_onboarding_step NOT NULL DEFAULT 'basic_info',
  role            v2_user_role NOT NULL DEFAULT 'USER',
  status          v2_user_status NOT NULL DEFAULT 'ACTIVE',
  -- A user row is only ever created by a verified code, so this is never
  -- null. It is stored rather than inferred because "when" is a question
  -- support will be asked.
  phone_verified_at timestamptz NOT NULL DEFAULT now(),
  -- Written by the session that a verified code opens. Null only for a row
  -- created and never signed into, which the flow does not produce.
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- The minimum age is a product rule, and a rule the database can hold as
  -- well as the schema: thirteen years, to the day.
  CONSTRAINT v2_users_min_age CHECK (
    birth_date IS NULL OR birth_date <= (CURRENT_DATE - INTERVAL '13 years')
  )
);

-- ─── One-time codes ─────────────────────────────────────────────────────────
-- At most one live challenge per number: issuing a code replaces the row,
-- which is precisely what invalidates the previous one.
CREATE TABLE v2_otp_challenges (
  phone               varchar(11) PRIMARY KEY,
  -- SHA-256 of `phone:code`. The code itself is never stored — not in
  -- production, and not when the development echo is on, so no environment
  -- can put a usable code into a row. Binding the hash to the number is
  -- what stops one being replayed against another.
  code_hash           char(64) NOT NULL,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  resend_available_at timestamptz NOT NULL,
  attempts            smallint NOT NULL DEFAULT 0
);

CREATE INDEX v2_otp_challenges_expires_at ON v2_otp_challenges (expires_at);

-- ─── The send log ───────────────────────────────────────────────────────────
-- Kept apart from the challenge because the challenge is overwritten on every
-- send and the limits have to count sends it no longer remembers — and
-- because one of them counts by address, which is not a property of a phone
-- number at all.
CREATE TABLE v2_otp_sends (
  id      bigserial PRIMARY KEY,
  phone   varchar(11) NOT NULL,
  -- Null when the caller's address could not be determined. `inet` rather
  -- than text so IPv6 forms compare as one address.
  ip      inet,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_otp_sends_phone_window ON v2_otp_sends (phone, sent_at DESC);
CREATE INDEX v2_otp_sends_ip_window ON v2_otp_sends (ip, sent_at DESC);

-- ─── Sessions ───────────────────────────────────────────────────────────────
-- A sign-in, as one long-lived thing. Access and refresh tokens come and go
-- inside it; revoking the session is what kills every token at once.
CREATE TABLE v2_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Rolling: pushed out again on every refresh, so a weekly visitor is never
  -- signed out.
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX v2_sessions_user ON v2_sessions (user_id);
CREATE INDEX v2_sessions_expires_at ON v2_sessions (expires_at);

-- Both token tables store hashes and never the token. SHA-256 with no salt
-- is right here and wrong for a password: these are 256 bits of CSPRNG
-- output, so there is no dictionary to try. What the hash buys is that a
-- leaked table cannot be presented back at the API.
CREATE TABLE v2_access_tokens (
  token_hash char(64) PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES v2_sessions (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX v2_access_tokens_session ON v2_access_tokens (session_id);
CREATE INDEX v2_access_tokens_expires_at ON v2_access_tokens (expires_at);

-- One link in a session's refresh chain. Each may be spent exactly once;
-- spending it sets `used_at` and issues the next. A request presenting a
-- token that is already spent is either a replay or a stolen copy racing the
-- real client, and the service revokes the whole session on it.
CREATE TABLE v2_refresh_tokens (
  token_hash char(64) PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES v2_sessions (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);

CREATE INDEX v2_refresh_tokens_session ON v2_refresh_tokens (session_id);
CREATE INDEX v2_refresh_tokens_expires_at ON v2_refresh_tokens (expires_at);
