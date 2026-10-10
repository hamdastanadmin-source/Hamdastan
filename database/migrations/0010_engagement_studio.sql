-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 — Engagement Studio: activities, their versions, participation,
-- responses and the admin history; and the XP ledger grown to pay for them.
--
-- Additive, apart from two CHECK constraints on v2_xp_transactions that are
-- replaced by wider ones (the source types gain 'engagement' and 'reversal',
-- and a reversal row carries a negative amount). Every existing row satisfies
-- the new constraints, so nothing already stored changes.
--
-- Shapes, and why:
--   v2_engagement_activities     one row per activity: what it is called, who
--                                it is for, when it runs, its publish state.
--   v2_engagement_versions       the questions and every scoring/XP setting,
--                                frozen per version. A published activity is
--                                never edited in place: an edit is a new
--                                version, and a response points at the one it
--                                answered.
--   v2_engagement_participations one row per (activity, person): progress,
--                                how many times they submitted and were paid.
--                                Locked FOR UPDATE on submit, which is what
--                                serialises one person's concurrent submits.
--   v2_engagement_responses      the answers. user_id is NULL for an anonymous
--                                survey and submitted_at is cut to the day,
--                                so nothing in the row ties it to a person or
--                                to the moment their participation changed.
--   v2_engagement_audit_log      what admins did, append-only.
--
-- The XP ledger stays the one ledger (v2_xp_transactions, from 0006). An
-- activity's reward is a row with source_type 'engagement', source_id
-- '<activity id>:<n>' (n = the person's nth paid submission), so the
-- existing unique key keeps it once-only. A revocation is a new row with
-- source_type 'reversal', the negated amount and reverses_id — the original
-- is never updated or deleted, and reverses_id is unique, so a grant can be
-- revoked once.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE v2_activity_type AS ENUM ('survey', 'mission', 'assessment');

-- 'scheduled' (published, start ahead) is derived from starts_at, not stored.
CREATE TYPE v2_activity_status AS ENUM ('draft', 'published', 'paused', 'closed', 'archived');

CREATE TYPE v2_participation_status AS ENUM ('in_progress', 'pending_review', 'completed', 'rejected');

CREATE TYPE v2_review_status AS ENUM ('none', 'pending', 'approved', 'rejected');

-- ─── Activities ─────────────────────────────────────────────────────────────
CREATE TABLE v2_engagement_activities (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type               v2_activity_type NOT NULL,
  status             v2_activity_status NOT NULL DEFAULT 'draft',
  title              varchar(120) NOT NULL,
  summary            varchar(200) NOT NULL DEFAULT '',
  instructions       text NOT NULL DEFAULT '',
  -- {"kind":"all"} | {"kind":"users","phones":[…]} | {"kind":"interests","categoryIds":[…]}
  audience           jsonb NOT NULL DEFAULT '{"kind":"all"}',
  current_version_id uuid,
  starts_at          timestamptz,
  ends_at            timestamptz,
  published_at       timestamptz,
  created_by         uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  updated_by         uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_engagement_activities_window
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX v2_engagement_activities_status ON v2_engagement_activities (status, created_at DESC);

-- ─── Versions ───────────────────────────────────────────────────────────────
CREATE TABLE v2_engagement_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES v2_engagement_activities (id) ON DELETE CASCADE,
  version     integer NOT NULL CONSTRAINT v2_engagement_versions_positive CHECK (version > 0),
  -- Steps, questions, assessment scoring and XP settings: @hamdastan/types ActivityDefinition.
  definition  jsonb NOT NULL,
  created_by  uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_engagement_versions_once UNIQUE (activity_id, version)
);

ALTER TABLE v2_engagement_activities
  ADD CONSTRAINT v2_engagement_activities_current_version
  FOREIGN KEY (current_version_id) REFERENCES v2_engagement_versions (id);

-- ─── Participation ──────────────────────────────────────────────────────────
CREATE TABLE v2_engagement_participations (
  activity_id  uuid NOT NULL REFERENCES v2_engagement_activities (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  status       v2_participation_status NOT NULL DEFAULT 'in_progress',
  submissions  integer NOT NULL DEFAULT 0 CONSTRAINT v2_engagement_participations_submissions CHECK (submissions >= 0),
  xp_awards    integer NOT NULL DEFAULT 0 CONSTRAINT v2_engagement_participations_xp_awards CHECK (xp_awards >= 0),
  -- Saved progress; cleared on submit.
  draft        jsonb,
  started_at   timestamptz NOT NULL DEFAULT now(),
  -- The first time a submission completed (or, when reviewed, was approved).
  completed_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id)
);

CREATE INDEX v2_engagement_participations_user ON v2_engagement_participations (user_id);

-- ─── Responses ──────────────────────────────────────────────────────────────
CREATE TABLE v2_engagement_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id   uuid NOT NULL REFERENCES v2_engagement_activities (id) ON DELETE CASCADE,
  version_id    uuid NOT NULL REFERENCES v2_engagement_versions (id) ON DELETE CASCADE,
  -- NULL for an anonymous survey.
  user_id       uuid REFERENCES v2_users (id) ON DELETE CASCADE,
  answers       jsonb NOT NULL,
  -- An assessment's computed result (AssessmentResult), and its knowledge score.
  result        jsonb,
  score         numeric(5, 2),
  passed        boolean,
  review_status v2_review_status NOT NULL DEFAULT 'none',
  review_note   varchar(300),
  reviewed_by   uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  submitted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_engagement_responses_activity ON v2_engagement_responses (activity_id, submitted_at);
CREATE INDEX v2_engagement_responses_pending ON v2_engagement_responses (activity_id)
  WHERE review_status = 'pending';
CREATE INDEX v2_engagement_responses_user ON v2_engagement_responses (user_id)
  WHERE user_id IS NOT NULL;

-- ─── Admin history ──────────────────────────────────────────────────────────
CREATE TABLE v2_engagement_audit_log (
  id          bigserial PRIMARY KEY,
  activity_id uuid REFERENCES v2_engagement_activities (id) ON DELETE CASCADE,
  admin_id    uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  action      varchar(40) NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_engagement_audit_log_activity ON v2_engagement_audit_log (activity_id, created_at DESC);

-- ─── XP ledger ──────────────────────────────────────────────────────────────
-- The two CHECKs are replaced, not loosened silently: the new ones still
-- require a positive amount on every row except a reversal, and tie a
-- reversal to the row it reverses.
ALTER TABLE v2_xp_transactions
  DROP CONSTRAINT v2_xp_transactions_source_type,
  DROP CONSTRAINT v2_xp_transactions_xp_amount,
  ADD COLUMN activity_id         uuid REFERENCES v2_engagement_activities (id),
  ADD COLUMN activity_version_id uuid REFERENCES v2_engagement_versions (id),
  ADD COLUMN reason              varchar(300),
  ADD COLUMN reverses_id         bigint
    CONSTRAINT v2_xp_transactions_reverses_once UNIQUE
    REFERENCES v2_xp_transactions (id),
  ADD COLUMN created_by_admin_id uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  ADD CONSTRAINT v2_xp_transactions_source_type CHECK (source_type IN (
    'personality_test', 'avatar_created', 'profile_completed', 'mission', 'engagement', 'reversal'
  )),
  ADD CONSTRAINT v2_xp_transactions_xp_amount CHECK (
    (source_type = 'reversal' AND xp_amount < 0) OR (source_type <> 'reversal' AND xp_amount > 0)
  ),
  ADD CONSTRAINT v2_xp_transactions_reversal CHECK (
    (source_type = 'reversal') = (reverses_id IS NOT NULL)
  );

CREATE INDEX v2_xp_transactions_activity ON v2_xp_transactions (activity_id)
  WHERE activity_id IS NOT NULL;
