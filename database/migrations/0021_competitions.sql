-- ═══════════════════════════════════════════════════════════════════════════
-- 0021 — competitions (مسابقه): a knowledge quiz taken once, inside a fixed
-- window, ranked by score and then by time taken.
--
-- Additive only: one new value of v2_activity_type. Nothing else changes —
--   • the ranking is read from what is already stored: the response's
--     `score` and `submitted_at`, and the participation's `started_at`
--     (set when the person starts, before the first question);
--   • an answer's explanation and the «show the answers» setting live in
--     the versioned definition (jsonb), like every other question setting.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited. The new value is not
-- used in this file (PostgreSQL refuses that inside the transaction that
-- adds it).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE v2_activity_type ADD VALUE 'competition';
