-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 — a journey's final result: the character a person came out as.
--
-- Additive only: one new table. Nothing existing is changed.
--
--   v2_journey_results  one row per (activity, person), written once, when
--                       the journey is finished (or, if that write was
--                       lost, the next time the person opens it). It keeps
--                       what was worked out at that moment — the character
--                       as it then read (name, title, description, image)
--                       and every trait's total — so a refresh, an edit of
--                       the characters or a new version of the journey
--                       never changes a result already given. The primary
--                       key is what makes a second result impossible.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE v2_journey_results (
  activity_id  uuid NOT NULL,
  user_id      uuid NOT NULL,
  -- The version whose characters and points decided it.
  version_id   uuid NOT NULL REFERENCES v2_engagement_versions (id) ON DELETE CASCADE,
  -- {"id","name","title","description","imageId"} as it was.
  character    jsonb NOT NULL,
  -- [{"id","title","score"}] in the admin's order.
  traits       jsonb NOT NULL DEFAULT '[]',
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id),
  CONSTRAINT v2_journey_results_participation
    FOREIGN KEY (activity_id, user_id)
    REFERENCES v2_engagement_participations (activity_id, user_id) ON DELETE CASCADE
);
