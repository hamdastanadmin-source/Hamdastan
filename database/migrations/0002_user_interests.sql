-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 — onboarding stage 1: the interests a person picks, and how far
-- through onboarding they are
--
-- Additive only: one new table and one new column with a default. Nothing
-- existing is changed or removed, so it is safe to apply to a database that
-- already has users in it.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Selected interests ─────────────────────────────────────────────────────
-- One row per interest a person has selected. The catalog itself is not a
-- table: it lives in `@hamdastan/config` (`onboarding.config.ts`), and the API
-- refuses any id that is not in it, so these columns hold catalog ids only.
--
-- `category_id` is stored rather than looked up because it is what product
-- questions are asked in ("how many people picked music?"), and the API
-- derives it from the interest id — it is never taken from the client.
--
-- Saving stage 1 replaces the person's whole set in one transaction, so the
-- primary key is also what keeps one interest from being stored twice.
CREATE TABLE v2_user_interests (
  user_id     uuid        NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  interest_id varchar(40) NOT NULL,
  category_id varchar(40) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, interest_id)
);

CREATE INDEX v2_user_interests_category ON v2_user_interests (category_id);

-- ─── Onboarding progress ────────────────────────────────────────────────────
-- `onboarding_step` says *whether* someone is in onboarding; this says how
-- far: the last of the three stages they have finished. It only moves
-- forward — going back to edit stage 1 does not reset a later stage.
ALTER TABLE v2_users
  ADD COLUMN onboarding_stage smallint NOT NULL DEFAULT 0
  CONSTRAINT v2_users_onboarding_stage_range CHECK (onboarding_stage BETWEEN 0 AND 3);
