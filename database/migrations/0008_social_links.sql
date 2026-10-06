-- ═══════════════════════════════════════════════════════════════════════════
-- 0008 — social links on the profile: Instagram, Telegram, LinkedIn
--
-- Additive only: three nullable columns on v2_users. Nothing existing is
-- changed, so it is safe to apply to a database that already has users.
--
-- Each holds the handle alone — never a URL — normalised to lower case by
-- @hamdastan/validation (`instagramSchema`, `telegramSchema`,
-- `linkedinSchema`). The app builds the link from the handle, so a stored
-- value can only ever point at the network it belongs to. The lengths are
-- each network's own maximum.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE v2_users
  ADD COLUMN instagram varchar(30),
  ADD COLUMN telegram varchar(32),
  ADD COLUMN linkedin varchar(100);
