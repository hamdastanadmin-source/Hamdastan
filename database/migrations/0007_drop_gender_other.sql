-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 — drop `OTHER` from `v2_gender`
--
-- The sign-up form no longer offers «سایر»; gender is «مرد» or «زن».
--
-- Anyone who had answered «سایر» has their gender cleared to NULL rather
-- than guessed. A null gender is what "the basic-info form has not been
-- filled in" means (users.service.ts `nextStepFor`), so on their next request
-- they are sent back to that form to choose again. Nothing else about the
-- account changes; re-submitting the form leaves `onboarding_step` alone.
--
-- PostgreSQL cannot remove a value from an enum, so the type is rebuilt:
-- rename the old one, create the new one under the original name, move the
-- column across, drop the old one. `v2_users.gender` is the only column of
-- this type.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE v2_users SET gender = NULL, updated_at = now() WHERE gender = 'OTHER';

ALTER TYPE v2_gender RENAME TO v2_gender_old;

CREATE TYPE v2_gender AS ENUM ('MALE', 'FEMALE');

ALTER TABLE v2_users
  ALTER COLUMN gender TYPE v2_gender USING gender::text::v2_gender;

DROP TYPE v2_gender_old;
