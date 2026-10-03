-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 — onboarding stage 2: the social questionnaire
--
-- Three new tables. Nothing existing is changed or removed, so it is safe to
-- apply to a database that already has users in it.
--
--   v2_questionnaire_answers  the raw answers — the source of truth
--   v2_social_profiles        progress, and the profile derived from the answers
--   v2_onboarding_events      the funnel: where people stop
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Raw answers ────────────────────────────────────────────────────────────
-- One row per question per person. Changing an answer is an UPSERT on the
-- primary key, never a second row, which is what keeps an edited answer from
-- stacking its score on top of the old one.
--
-- `answer` holds the stable option codes from `@hamdastan/config`
-- (`questionnaire.config.ts`), never the Persian label, and its shape depends
-- on the kind of question:
--   single  {"option": "INITIATES"}
--   multi   {"options": ["LIGHT", "DEEP"]}
--   ranked  {"ranked": ["SOCIAL", "FUN"]}      (Q1, most important first)
--   slider  {"value": 7}
--
-- `presentation_index` is where the question was shown (1–20). It is recorded
-- for analysis only: no score is ever derived from it.
CREATE TABLE v2_questionnaire_answers (
  user_id            uuid        NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  question_id        varchar(4)  NOT NULL
    CONSTRAINT v2_questionnaire_answers_question_id CHECK (question_id ~ '^Q([1-9]|1[0-9]|20)$'),
  answer             jsonb       NOT NULL,
  presentation_index smallint    NOT NULL
    CONSTRAINT v2_questionnaire_answers_presentation_index CHECK (presentation_index BETWEEN 1 AND 20),
  -- First answered, and last changed.
  answered_at        timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

-- ─── Progress and the derived profile ───────────────────────────────────────
-- One row per person who has answered at least once. Every column below the
-- progress block is *derived*: it is rewritten whole from
-- v2_questionnaire_answers on every save, under `scoring_version`, so a new
-- scoring version can rebuild every profile without anyone answering again.
CREATE TABLE v2_social_profiles (
  user_id                    uuid        PRIMARY KEY REFERENCES v2_users (id) ON DELETE CASCADE,
  scoring_version            varchar(40) NOT NULL,

  -- Where to resume: the first unanswered question in presentation order.
  -- Null once every question is answered.
  current_question_id        varchar(4),
  current_section            smallint
    CONSTRAINT v2_social_profiles_current_section CHECK (current_section BETWEEN 1 AND 4),
  progress                   smallint    NOT NULL DEFAULT 0
    CONSTRAINT v2_social_profiles_progress CHECK (progress BETWEEN 0 AND 100),
  questionnaire_completed    boolean     NOT NULL DEFAULT false,
  questionnaire_completed_at timestamptz,

  -- Every answer's raw contribution, by question:
  --   {"Q2": {"SI": 4, "SE": 2, "LISTENING": 0}, "Q12": {"CO": 8, "CP_SUPPORT": 6}, …}
  raw_score_contributions    jsonb       NOT NULL DEFAULT '{}',
  -- The same contributions summed per dimension, before normalisation.
  raw_dimensions             jsonb       NOT NULL DEFAULT '{}',
  -- Internal signals that feed the role engine but are not profile
  -- dimensions (LISTENING, DEBATE), normalised to 0–10.
  normalized_signals         jsonb       NOT NULL DEFAULT '{}',

  -- The fourteen dimensions, 1–10. Columns rather than jsonb because matching
  -- will filter and compare on them. Null until the questions that feed one
  -- have been answered.
  si numeric(4,2), se numeric(4,2), cd numeric(4,2), ao numeric(4,2),
  sp numeric(4,2), cp numeric(4,2), co numeric(4,2), nv numeric(4,2),
  st numeric(4,2), fl numeric(4,2), so numeric(4,2), bp numeric(4,2),
  pu numeric(4,2), wu numeric(4,2),

  -- Categorical outputs.
  motivation_profile         jsonb,      -- {"ranked": ["SOCIAL","FUN"], "scores": {"SOCIAL": 3, "FUN": 2}}
  conversation_preferences   jsonb,      -- {"LIGHT": 3, "DEEP": 3}
  preferred_group_size       varchar(6)
    CONSTRAINT v2_social_profiles_group_size CHECK (preferred_group_size IN ('SMALL', 'MEDIUM', 'LARGE', 'XL')),
  -- Availability is a matching constraint, not a score.
  available_morning          boolean,
  available_afternoon        boolean,
  available_evening          boolean,
  available_weekend          boolean,
  -- Penalty triggers for group balancing, e.g. {'HIGH_CP','LOW_ST_LOW_PU'}.
  conflict_sensitivities     text[],

  -- The role engine: all seven scores are kept, not only the winners.
  role_scores                jsonb,
  primary_role               varchar(12),
  -- Null unless it scores at least 70% of the primary.
  secondary_role             varchar(12),

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT v2_social_profiles_completed_at CHECK (
    NOT questionnaire_completed OR questionnaire_completed_at IS NOT NULL
  )
);

-- ─── Funnel analytics ───────────────────────────────────────────────────────
-- Append-only. Nothing reads answers from here; it exists to answer "where
-- do people stop?". `presentation_index` is filled in by the API from the
-- question id, never taken from the client.
CREATE TABLE v2_onboarding_events (
  id                 bigserial   PRIMARY KEY,
  user_id            uuid        NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  event              varchar(40) NOT NULL
    CONSTRAINT v2_onboarding_events_event CHECK (event IN (
      'quiz_started', 'quiz_question_viewed', 'quiz_question_answered',
      'quiz_back_clicked', 'quiz_section_completed', 'quiz_abandoned',
      'quiz_resumed', 'quiz_completed', 'quiz_result_viewed',
      'quiz_result_continue_clicked'
    )),
  question_id        varchar(4),
  presentation_index smallint,
  section_id         smallint,
  -- answer_type, time_spent_ms, selection_count — whichever apply.
  properties         jsonb       NOT NULL DEFAULT '{}',
  occurred_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_onboarding_events_funnel ON v2_onboarding_events (event, occurred_at);
CREATE INDEX v2_onboarding_events_user ON v2_onboarding_events (user_id, occurred_at);
