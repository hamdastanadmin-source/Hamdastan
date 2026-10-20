-- ═══════════════════════════════════════════════════════════════════════════
-- 0020 — the world CMS: a world's life and identity, its menu and home page,
-- the news and knowledge articles filed under it, and which activities
-- belong to it.
--
--   v2_worlds                      gains a lifecycle (`status` replaces
--                                  `is_active`: an active world becomes
--                                  `published`, an inactive one
--                                  `unpublished`), a tagline, a long
--                                  description, a logo, a theme preset and
--                                  its menu (`navigation`, an ordered list
--                                  of sections with their labels).
--   v2_articles                    a news item (خبر) or a knowledge article
--                                  (دانستنی). Draft → published (from
--                                  `publish_at`) ⇄ unpublished → archived.
--   v2_article_world_links         article ↔ world, many to many.
--   v2_article_audit_log           who did what to an article.
--   v2_engagement_activity_worlds  activity ↔ world, many to many. Not part
--                                  of an activity's version: filing it under
--                                  a world changes nothing anyone answered.
--   v2_world_home_sections         a world home's sections — one per kind —
--                                  in order, each on or off, filled with the
--                                  latest eligible items or with the ones an
--                                  admin featured.
--   v2_world_home_items            the featured items of a section, in order.
--                                  One real foreign key per kind of item, so
--                                  deleting the item removes it from the
--                                  home and a bad id cannot be stored.
--
-- Nothing is deleted: worlds, events and activities keep every link. A
-- world is archived, never dropped, once anything is filed under it.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Worlds ──────────────────────────────────────────────────────────────────

CREATE TYPE v2_world_status AS ENUM ('draft', 'published', 'unpublished', 'archived');

ALTER TABLE v2_worlds
  ADD COLUMN status        v2_world_status NOT NULL DEFAULT 'draft',
  ADD COLUMN tagline       varchar(120) NOT NULL DEFAULT '',
  ADD COLUMN description   text NOT NULL DEFAULT ''
    CONSTRAINT v2_worlds_description_length CHECK (char_length(description) <= 4000),
  ADD COLUMN logo_media_id uuid REFERENCES v2_media_assets (id) ON DELETE SET NULL,
  -- A key from WORLD_THEMES (@hamdastan/config); the product maps it to tokens.
  ADD COLUMN theme         varchar(20) NOT NULL DEFAULT 'neutral',
  -- [{ "section": "news", "label": "اخبار", "enabled": true }, …] in menu
  -- order (WORLD_SECTIONS); checked by worldInputSchema on every write.
  ADD COLUMN navigation    jsonb NOT NULL DEFAULT '[]'
    CONSTRAINT v2_worlds_navigation_array CHECK (jsonb_typeof(navigation) = 'array'),
  ADD COLUMN published_at  timestamptz;

UPDATE v2_worlds
   SET status = CASE WHEN is_active THEN 'published'::v2_world_status ELSE 'unpublished'::v2_world_status END,
       published_at = CASE WHEN is_active THEN now() END,
       navigation = '[
         {"section": "home", "label": "خانه", "enabled": true},
         {"section": "news", "label": "اخبار", "enabled": true},
         {"section": "knowledge", "label": "دانستنی‌ها", "enabled": true},
         {"section": "events", "label": "رویدادها", "enabled": true},
         {"section": "activities", "label": "فعالیت‌ها", "enabled": true}
       ]'::jsonb;

-- allow-destructive: `is_active` is carried into `status` by the UPDATE above,
-- in the same transaction (true → published, false → unpublished), so no value
-- is lost; keeping both would leave two answers to «may the product show it».
ALTER TABLE v2_worlds DROP COLUMN is_active;

CREATE INDEX v2_worlds_status ON v2_worlds (status, position);

-- ─── Articles ────────────────────────────────────────────────────────────────

CREATE TYPE v2_article_kind AS ENUM ('news', 'knowledge');
CREATE TYPE v2_article_status AS ENUM ('draft', 'published', 'unpublished', 'archived');

CREATE TABLE v2_articles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               v2_article_kind NOT NULL,
  slug               varchar(80) NOT NULL
    CONSTRAINT v2_articles_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title              varchar(120) NOT NULL DEFAULT '',
  summary            varchar(300) NOT NULL DEFAULT '',
  -- Plain text; a blank line starts a paragraph. Never HTML.
  body               text NOT NULL DEFAULT ''
    CONSTRAINT v2_articles_body_length CHECK (char_length(body) <= 20000),
  category           varchar(40) NOT NULL DEFAULT '',
  cover_media_id     uuid REFERENCES v2_media_assets (id) ON DELETE SET NULL,
  cover_alt          varchar(150) NOT NULL DEFAULT '',
  thumbnail_media_id uuid REFERENCES v2_media_assets (id) ON DELETE SET NULL,
  status             v2_article_status NOT NULL DEFAULT 'draft',
  -- The publication date: a published article appears from then on.
  publish_at         timestamptz,
  created_by         uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  updated_by         uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_articles_slug_unique UNIQUE (slug),
  CONSTRAINT v2_articles_published_has_date CHECK (status <> 'published' OR publish_at IS NOT NULL)
);

CREATE INDEX v2_articles_live ON v2_articles (kind, publish_at DESC) WHERE status = 'published';
CREATE INDEX v2_articles_updated ON v2_articles (updated_at DESC);

CREATE TABLE v2_article_world_links (
  article_id uuid NOT NULL REFERENCES v2_articles (id) ON DELETE CASCADE,
  world_id   uuid NOT NULL REFERENCES v2_worlds (id) ON DELETE RESTRICT,
  PRIMARY KEY (article_id, world_id)
);

CREATE INDEX v2_article_world_links_world ON v2_article_world_links (world_id);

CREATE TABLE v2_article_audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  article_id  uuid NOT NULL REFERENCES v2_articles (id) ON DELETE CASCADE,
  admin_id    uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  action      varchar(40) NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_article_audit_log_article ON v2_article_audit_log (article_id, created_at DESC);

-- ─── Activities ──────────────────────────────────────────────────────────────

CREATE TABLE v2_engagement_activity_worlds (
  activity_id uuid NOT NULL REFERENCES v2_engagement_activities (id) ON DELETE CASCADE,
  world_id    uuid NOT NULL REFERENCES v2_worlds (id) ON DELETE RESTRICT,
  PRIMARY KEY (activity_id, world_id)
);

CREATE INDEX v2_engagement_activity_worlds_world ON v2_engagement_activity_worlds (world_id);

-- ─── World home ──────────────────────────────────────────────────────────────

CREATE TYPE v2_world_section_kind AS ENUM ('news', 'knowledge', 'events', 'activities');

CREATE TABLE v2_world_home_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id    uuid NOT NULL REFERENCES v2_worlds (id) ON DELETE CASCADE,
  kind        v2_world_section_kind NOT NULL,
  -- Empty: the section's default title (WORLD_SECTION_LABELS).
  title       varchar(60) NOT NULL DEFAULT '',
  -- latest: the newest eligible items; featured: only the ones chosen below.
  source      varchar(10) NOT NULL DEFAULT 'latest'
    CONSTRAINT v2_world_home_sections_source CHECK (source IN ('latest', 'featured')),
  item_limit  smallint NOT NULL DEFAULT 3
    CONSTRAINT v2_world_home_sections_limit CHECK (item_limit BETWEEN 1 AND 12),
  -- hide: no eligible item, no section; message: the section with its empty state.
  when_empty  varchar(10) NOT NULL DEFAULT 'hide'
    CONSTRAINT v2_world_home_sections_when_empty CHECK (when_empty IN ('hide', 'message')),
  is_enabled  boolean NOT NULL DEFAULT true,
  position    integer NOT NULL DEFAULT 0,
  CONSTRAINT v2_world_home_sections_one_per_kind UNIQUE (world_id, kind)
);

CREATE TABLE v2_world_home_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES v2_world_home_sections (id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  article_id  uuid REFERENCES v2_articles (id) ON DELETE CASCADE,
  event_id    uuid REFERENCES v2_events (id) ON DELETE CASCADE,
  activity_id uuid REFERENCES v2_engagement_activities (id) ON DELETE CASCADE,
  CONSTRAINT v2_world_home_items_one_target CHECK (num_nonnulls(article_id, event_id, activity_id) = 1)
);

CREATE UNIQUE INDEX v2_world_home_items_article ON v2_world_home_items (section_id, article_id) WHERE article_id IS NOT NULL;
CREATE UNIQUE INDEX v2_world_home_items_event ON v2_world_home_items (section_id, event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX v2_world_home_items_activity ON v2_world_home_items (section_id, activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX v2_world_home_items_order ON v2_world_home_items (section_id, position);

-- Every world that exists gets the default home: all four sections, latest first.
INSERT INTO v2_world_home_sections (world_id, kind, position)
SELECT w.id, s.kind::v2_world_section_kind, s.position
  FROM v2_worlds w
 CROSS JOIN (VALUES ('news', 1), ('events', 2), ('activities', 3), ('knowledge', 4)) AS s (kind, position);
