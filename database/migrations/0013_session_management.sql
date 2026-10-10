-- ═══════════════════════════════════════════════════════════════════════════
-- 0013 — session lifetimes and session management
--
-- Additive only: nullable columns, and one with a constant default. No row
-- is rewritten and no session ends because of this file.
--
-- Product sessions gain an absolute end. A session is renewed for seven days
-- on every refresh (the idle timeout) but never beyond absolute_expires_at,
-- thirty days after sign-in. Sessions that predate this migration have it
-- NULL, and the API sets it on their next refresh to thirty days from that
-- moment — so an existing session is not cut short by a rule it was not
-- issued under; it simply joins the new one.
--
-- The device columns are what an admin sees when managing a person's
-- sessions; revoked_reason says why one ended (sign-out, a replayed refresh
-- token, an admin).
--
-- Admin sessions gain last_seen_at for the two-hour idle timeout. Existing
-- ones start from the moment this runs, so nobody is signed out by it.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE v2_sessions
  ADD COLUMN absolute_expires_at timestamptz,
  ADD COLUMN last_seen_at        timestamptz,
  ADD COLUMN user_agent          varchar(300),
  ADD COLUMN ip                  inet,
  ADD COLUMN revoked_reason      varchar(30);

ALTER TABLE v2_admin_sessions
  ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
