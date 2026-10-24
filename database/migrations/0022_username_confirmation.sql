-- ═══════════════════════════════════════════════════════════════════════════
-- 0022 — the username step of sign-up
--
-- Every account is born with a generated username (`user` and eight digits,
-- 0006). Sign-up now asks the person to keep it or choose their own, right
-- after the basic-info form; this column is what says they have answered.
-- Null means the step is still ahead of them, and the routing table sends
-- them to it.
--
-- Additive only: one nullable column. Accounts that are already past basic
-- info are backfilled as answered, so nobody already in the app is stopped
-- on a screen meant for sign-up. An account still on the basic-info form
-- will meet the step when it gets there.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE v2_users
  ADD COLUMN username_confirmed_at timestamptz;

UPDATE v2_users
   SET username_confirmed_at = now()
 WHERE first_name IS NOT NULL;
