-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 — wrong one-time codes, counted per number across codes
--
-- Additive only: one new table. Nothing existing is changed.
--
-- v2_otp_challenges counts wrong guesses against *one* code and is replaced
-- when the next code is issued, so on its own it lets an attacker guess five
-- times, ask for a fresh code, and guess five more. This row outlives the
-- codes: once a number reaches OTP_MAX_FAILURES inside the window, neither a
-- new code nor a verification is accepted for it until the window ends. A
-- correct code deletes the row.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE v2_otp_failures (
  -- Normalised to 09xxxxxxxxx, like v2_otp_challenges.phone.
  phone             varchar(11) PRIMARY KEY,
  failures          integer NOT NULL DEFAULT 0 CONSTRAINT v2_otp_failures_failures CHECK (failures >= 0),
  -- The window runs from the first failure; a failure after it ends starts a new one.
  window_started_at timestamptz NOT NULL DEFAULT now()
);

-- For the cleanup job: rows whose window ended long ago.
CREATE INDEX v2_otp_failures_window ON v2_otp_failures (window_started_at);
