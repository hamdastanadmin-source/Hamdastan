-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 — who may sign in to the admin panel, and their sessions
--
-- Additive only: one enum, two new tables and a seed. Nothing existing is
-- changed, so it is safe to apply to a database that already has users.
--
-- An admin is deliberately *not* a row in v2_users. Verifying a code creates
-- a product account for any number, which is exactly what the admin panel
-- must never do: an admin exists only because another admin added them
-- here, and deactivating one must not touch their product account (or the
-- other way round).
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE v2_admin_status AS ENUM ('ACTIVE', 'INACTIVE');

-- ─── Admin users ────────────────────────────────────────────────────────────
-- The allow-list. Sign-in proves the number with a one-time code, then looks
-- it up here; a number that is missing, or INACTIVE, gets no session.
CREATE TABLE v2_admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Normalised to 09xxxxxxxxx by @hamdastan/validation, like v2_users.phone,
  -- so the unique index is meaningful and the OTP lookup matches.
  phone         varchar(11) NOT NULL UNIQUE,
  first_name    varchar(30) NOT NULL,
  last_name     varchar(40) NOT NULL,
  status        v2_admin_status NOT NULL DEFAULT 'ACTIVE',
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Admin sessions ─────────────────────────────────────────────────────────
-- One opaque token per sign-in, stored as SHA-256 like the product's tokens.
-- Every request re-reads the admin's status alongside the session, and
-- deactivating an admin also revokes every session they hold — either alone
-- would lock them out; both together leave no window.
CREATE TABLE v2_admin_sessions (
  token_hash char(64) PRIMARY KEY,
  admin_id   uuid NOT NULL REFERENCES v2_admin_users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX v2_admin_sessions_admin ON v2_admin_sessions (admin_id);
CREATE INDEX v2_admin_sessions_expires_at ON v2_admin_sessions (expires_at);

-- ─── Seed ───────────────────────────────────────────────────────────────────
-- With no admin there is nobody to add the first one, so the main admin is
-- seeded here. Anyone the product already marks as ADMIN keeps that access
-- too; their names may still be empty, hence the placeholders.
INSERT INTO v2_admin_users (phone, first_name, last_name)
VALUES ('09059466960', 'امید', 'بهشتی')
ON CONFLICT (phone) DO NOTHING;

INSERT INTO v2_admin_users (phone, first_name, last_name)
SELECT phone, COALESCE(first_name, 'مدیر'), COALESCE(last_name, 'سامانه')
  FROM v2_users
 WHERE role = 'ADMIN'
ON CONFLICT (phone) DO NOTHING;
