-- ═══════════════════════════════════════════════════════════════════════════
-- 0024 — a person's like or dislike on a news item or knowledge article
--
--   v2_article_reactions  one row per person and article: «like» or
--                         «dislike». Taking it back deletes the row, so the
--                         counts are a count of rows.
--
-- Additive: one new table. Nothing is changed or dropped.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE v2_article_reactions (
  article_id  uuid NOT NULL REFERENCES v2_articles (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  reaction    text NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Article first: the counts read by article, and this is their index.
  PRIMARY KEY (article_id, user_id)
);

-- A person's account deletion cascades through this.
CREATE INDEX v2_article_reactions_user_idx ON v2_article_reactions (user_id);
