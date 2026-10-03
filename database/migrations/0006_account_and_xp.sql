-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 — the account area: profile fields, avatar, settings, and the XP ledger
--
-- Additive only: five nullable/defaulted columns on v2_users, one new table,
-- and a backfill of rewards already earned. Nothing existing is changed or
-- removed, so it is safe to apply to a database that already has users.
--
-- What is deliberately *not* stored, because it is derived:
--   level, xp_total       the ledger's sum and LEVEL_THRESHOLDS in @hamdastan/config
--   mission status        a mission is done exactly when its ledger row exists
--   avatar_completed      avatar_config IS NOT NULL
--   profile_completed     username and city are both set
--   personality_*         v2_social_profiles already holds it (0004)
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Profile fields ─────────────────────────────────────────────────────────
-- `username` is normalised to lower case by @hamdastan/validation before it
-- reaches here; the CHECK holds the database to the same rule, which is what
-- makes the plain unique index a case-insensitive one.
ALTER TABLE v2_users
  ADD COLUMN username varchar(20)
    CONSTRAINT v2_users_username_lower CHECK (username = lower(username)),
  ADD COLUMN bio varchar(160),
  ADD COLUMN city varchar(40),
  -- {"base": "base-2", "top": "tee", "bottom": "jeans", "shoes": "sneakers",
  --  "accessory": "none"} — ids from AVATAR_CATALOG. Null until the person
  -- saves one; the product shows a default avatar until then.
  ADD COLUMN avatar_config jsonb,
  -- {"notifications": true, "showSocialProfile": true}. Missing keys take
  -- DEFAULT_SETTINGS, so a new setting needs no migration.
  ADD COLUMN settings jsonb NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX v2_users_username ON v2_users (username);

-- ─── XP ledger ──────────────────────────────────────────────────────────────
-- Append-only. One row per reward; the total is the sum. The unique key is
-- what makes a reward impossible to grant twice — two requests finishing the
-- same mission at once both try to insert, and one of them gets nothing.
--
--   source_type  personality_test | avatar_created | profile_completed | mission
--   source_id    what in particular earned it; for the one-off achievements
--                above it repeats source_type, for a future mission it is the
--                mission's id
CREATE TABLE v2_xp_transactions (
  id          bigserial    PRIMARY KEY,
  user_id     uuid         NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  source_type varchar(30)  NOT NULL
    CONSTRAINT v2_xp_transactions_source_type CHECK (source_type IN (
      'personality_test', 'avatar_created', 'profile_completed', 'mission'
    )),
  source_id   varchar(60)  NOT NULL,
  xp_amount   integer      NOT NULL
    CONSTRAINT v2_xp_transactions_xp_amount CHECK (xp_amount > 0),
  created_at  timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT v2_xp_transactions_once UNIQUE (user_id, source_type, source_id)
);

-- ─── Backfill ───────────────────────────────────────────────────────────────
-- People who finished the questionnaire before XP existed have earned its
-- reward. 50 is MISSIONS' personality_test reward at the time of writing;
-- dated to when they actually finished.
INSERT INTO v2_xp_transactions (user_id, source_type, source_id, xp_amount, created_at)
SELECT user_id, 'personality_test', 'personality_test', 50, questionnaire_completed_at
  FROM v2_social_profiles
 WHERE questionnaire_completed
ON CONFLICT ON CONSTRAINT v2_xp_transactions_once DO NOTHING;
