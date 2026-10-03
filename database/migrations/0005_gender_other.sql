-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 — restore `OTHER` to `v2_gender` where 0001 was applied without it
--
-- The same story as 0003: 0001 was applied from a draft whose enum was
-- ('MALE', 'FEMALE'), and the file was edited afterwards to add 'OTHER'.
-- The sign-up form offers «سایر», the API writes 'OTHER', and on such a
-- database every one of those saves failed with 500 ("invalid input value
-- for enum v2_gender").
--
-- `IF NOT EXISTS` makes this correct on both kinds of database: one built
-- from today's 0001 already has the value and this is a no-op; one built
-- from the draft gets it. Adding an enum value is additive only, and allowed
-- inside the runner's transaction on PostgreSQL 12 and later.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE v2_gender ADD VALUE IF NOT EXISTS 'OTHER';
