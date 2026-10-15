-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 — Engagement Studio: the multi-day journey (چالش چندروزه).
--
-- Additive only: one enum value, one widened column, two new tables. Nothing
-- existing is changed or removed, so surveys, missions and assessments —
-- and every row they already have — are untouched.
--
-- A journey is an activity like the others: a campaign with a start and an
-- end (v2_engagement_activities), its days the steps of its versioned
-- definition, its settings in that definition (`journey`). The person's
-- journey as a whole is their v2_engagement_participations row: created by
-- their first answer, completed_at set when they finish. What is new:
--
--   v2_journey_answers          one row per answer, written the moment the
--                               person gives it — this is where a day's data
--                               lives while they answer, and what lets them
--                               leave and come back. The primary key
--                               (activity, person, question) is what makes an
--                               answer impossible to record twice; a row is
--                               never updated. day_id is the day the
--                               question was on when it was answered;
--                               version_id the version it was answered in.
--                               value is NULL for a skipped optional question.
--
--   v2_journey_day_completions  one row per day a person finished — the
--                               moment its last question got an answer.
--                               Written once (primary key), in the same
--                               transaction as that answer and the day's XP.
--
-- The results dashboard and the CSV read a finished day's answers from
-- these two tables; nothing is copied into v2_engagement_responses.
--
-- XP stays in the one ledger. A journey pays, each at most once by the
-- ledger's unique key: an answer ('<activity>:q:<question id>'), a finished
-- day ('<activity>:d:<day id>'), and the whole journey ('<activity>:1', the
-- key a single-award activity already uses). The answer key can run past 60
-- characters, so source_id is widened to 100; widening a varchar rewrites
-- no rows and every existing value still fits.
--
-- 'journey' is added to v2_activity_type. Postgres (12+) allows ADD VALUE
-- inside the migration's transaction as long as nothing in that same
-- transaction uses the new value, and nothing here does.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE v2_activity_type ADD VALUE 'journey';

ALTER TABLE v2_xp_transactions ALTER COLUMN source_id TYPE varchar(100);

-- ─── Answers ────────────────────────────────────────────────────────────────
CREATE TABLE v2_journey_answers (
  activity_id uuid NOT NULL,
  user_id     uuid NOT NULL,
  question_id varchar(40) NOT NULL,
  day_id      varchar(40) NOT NULL,
  version_id  uuid NOT NULL REFERENCES v2_engagement_versions (id) ON DELETE CASCADE,
  value       jsonb,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id, question_id),
  CONSTRAINT v2_journey_answers_participation
    FOREIGN KEY (activity_id, user_id)
    REFERENCES v2_engagement_participations (activity_id, user_id) ON DELETE CASCADE
);

-- The dashboard reads a day's answers across everyone.
CREATE INDEX v2_journey_answers_day ON v2_journey_answers (activity_id, day_id);

-- ─── Finished days ──────────────────────────────────────────────────────────
CREATE TABLE v2_journey_day_completions (
  activity_id  uuid NOT NULL,
  user_id      uuid NOT NULL,
  day_id       varchar(40) NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id, day_id),
  CONSTRAINT v2_journey_day_completions_participation
    FOREIGN KEY (activity_id, user_id)
    REFERENCES v2_engagement_participations (activity_id, user_id) ON DELETE CASCADE
);
