-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 — restore `v2_users.last_login_at` where 0001 was applied without it
--
-- 0001 was applied from a draft that did not yet have this column, and the
-- file was edited afterwards — the very thing the runner exists to refuse.
-- The live table therefore lacks a column the file declares and the auth
-- repository writes on every verified code, so sign-in failed with 500.
--
-- `IF NOT EXISTS` is what makes this correct on both kinds of database: one
-- built from today's 0001 already has the column and this is a no-op; one
-- built from the draft gets it. Nullable, no default — additive only.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE v2_users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
