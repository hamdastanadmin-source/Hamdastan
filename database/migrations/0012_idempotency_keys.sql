-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 — idempotency keys
--
-- Additive only: one new table. Nothing existing is changed.
--
-- A client sends `Idempotency-Key` with a write it may have to retry — a
-- dropped connection after the server committed looks, to the client,
-- exactly like one before. The first request claims the key *inside the
-- transaction that does the work*, and records the outcome there; a retry
-- finds the row and is answered from it, so a response is stored and its XP
-- granted once however many times the request arrives. A concurrent
-- duplicate waits on the claim (the primary key) and then reads the outcome.
--
-- Keys are kept until expires_at, long after any retry, so a late retry of an
-- older request is still recognised — not only the most recent one. The
-- request_hash stops a key being reused for a different request.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE v2_idempotency_keys (
  -- What the key is for, e.g. 'engagement.submit'. Keys are per scope and
  -- per owner: two people may well generate the same one.
  scope        varchar(60) NOT NULL,
  -- The user (or admin) who sent it. Not a foreign key: scopes span both.
  owner_id     uuid NOT NULL,
  idem_key     varchar(100) NOT NULL,
  -- SHA-256 of the canonical request body and target.
  request_hash char(64) NOT NULL,
  -- The outcome to answer a retry with. NULL only inside the claiming
  -- transaction, so no other session ever sees it NULL.
  outcome      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  PRIMARY KEY (scope, owner_id, idem_key)
);

-- For the cleanup job.
CREATE INDEX v2_idempotency_keys_expires_at ON v2_idempotency_keys (expires_at);
