-- ═══════════════════════════════════════════════════════════════════════════
-- 0018 — events (رویدادها) and the minimal world list they are filed under.
--
-- Additive only: new enums, new tables and seed rows. Nothing existing is
-- changed.
--
--   v2_worlds                 the story worlds, as a plain list an admin
--                             keeps: name, slug, cover, order, on/off. No
--                             membership yet — that is a later migration.
--   v2_event_categories       content categories (کارگاه، موسیقی، …). The
--                             slug is the stable identity; the name is copy.
--   v2_events                 one event. Four separate questions, four
--                             separate columns:
--                               status      where it is in its life
--                                           (draft → published → …)
--                               publish_at  when a published event appears
--                                           («scheduled» is read off the
--                                           clock, as in Engagement Studio)
--                               visibility  where it may appear
--                                           (public / world / restricted)
--                               booking_mode how a person takes part
--                             «ended» is read from end_at; availability from
--                             the ticket options and the bookings.
--   v2_event_category_links   event ↔ category, many to many.
--   v2_event_world_links      event ↔ world, many to many — independent of
--                             visibility: a public event may belong to worlds.
--   v2_event_media            the gallery, in order.
--   v2_event_ticket_options   ticket types (عادی، VIP، دانشجویی) and prices.
--   v2_event_interests        «علاقه‌مندم», with the in-app reminder switch.
--   v2_event_bookings         a person's registration or external handoff.
--                             An external booking stays «pending» until it is
--                             confirmed; returning to the app proves nothing.
--   v2_event_audit_log        who did what to an event, category or world.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Worlds ──────────────────────────────────────────────────────────────────

CREATE TABLE v2_worlds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           varchar(60) NOT NULL
    CONSTRAINT v2_worlds_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name           varchar(80) NOT NULL,
  summary        varchar(300) NOT NULL DEFAULT '',
  cover_media_id uuid REFERENCES v2_media_assets (id) ON DELETE SET NULL,
  position       integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_worlds_slug_unique UNIQUE (slug)
);

CREATE INDEX v2_worlds_order ON v2_worlds (position, name);

INSERT INTO v2_worlds (slug, name, position) VALUES
  ('hogwarts', 'هاگوارتز', 1),
  ('gta', 'جی‌تی‌ای', 2),
  ('game-of-thrones', 'بازی تاج و تخت', 3),
  ('liverpool', 'لیورپول', 4);

-- ─── Categories ──────────────────────────────────────────────────────────────

CREATE TABLE v2_event_categories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           varchar(60) NOT NULL
    CONSTRAINT v2_event_categories_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name           varchar(60) NOT NULL,
  description    varchar(300) NOT NULL DEFAULT '',
  -- A key from EVENT_CATEGORY_ICONS (@hamdastan/config); the product draws it.
  icon           varchar(40) NOT NULL DEFAULT 'sparkles',
  image_media_id uuid REFERENCES v2_media_assets (id) ON DELETE SET NULL,
  position       integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_event_categories_slug_unique UNIQUE (slug)
);

CREATE INDEX v2_event_categories_order ON v2_event_categories (position, name);

INSERT INTO v2_event_categories (slug, name, icon, position) VALUES
  ('workshop', 'کارگاه', 'hammer', 1),
  ('show', 'نمایش', 'drama', 2),
  ('gallery', 'گالری و نمایشگاه', 'image', 3),
  ('music', 'موسیقی', 'music', 4),
  ('books', 'کتاب و ادبیات', 'book-open', 5),
  ('games', 'بازی و گیم', 'gamepad-2', 6),
  ('sports', 'ورزش', 'dumbbell', 7),
  ('science', 'علم و فناوری', 'flask-conical', 8),
  ('family', 'خانواده', 'users', 9),
  ('entertainment', 'خرید و سرگرمی', 'shopping-bag', 10),
  ('fan-meetup', 'گردهمایی هواداری', 'megaphone', 11),
  ('other', 'سایر', 'sparkles', 12);

-- ─── Events ──────────────────────────────────────────────────────────────────

CREATE TYPE v2_event_type AS ENUM ('physical', 'online', 'hybrid');
CREATE TYPE v2_event_status AS ENUM ('draft', 'published', 'unpublished', 'cancelled', 'archived');
CREATE TYPE v2_event_visibility AS ENUM ('public', 'world', 'restricted');
CREATE TYPE v2_event_booking_mode AS ENUM ('none', 'free_registration', 'external');

-- A draft may be incomplete; publishing checks completeness in the API.
CREATE TABLE v2_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    varchar(80) NOT NULL
    CONSTRAINT v2_events_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title                   varchar(120) NOT NULL,
  summary                 varchar(200) NOT NULL DEFAULT '',
  -- A small Markdown subset; the product renders it to elements, never HTML.
  description             text NOT NULL DEFAULT ''
    CONSTRAINT v2_events_description_length CHECK (char_length(description) <= 10000),
  event_type              v2_event_type NOT NULL DEFAULT 'physical',
  cover_media_id          uuid REFERENCES v2_media_assets (id) ON DELETE SET NULL,
  cover_alt               varchar(200) NOT NULL DEFAULT '',
  start_at                timestamptz,
  end_at                  timestamptz,
  time_zone               varchar(60) NOT NULL DEFAULT 'Asia/Tehran',
  registration_deadline   timestamptz,
  venue_name              varchar(120) NOT NULL DEFAULT '',
  city                    varchar(60) NOT NULL DEFAULT '',
  address                 varchar(300) NOT NULL DEFAULT '',
  latitude                numeric(9, 6)
    CONSTRAINT v2_events_latitude CHECK (latitude BETWEEN -90 AND 90),
  longitude               numeric(9, 6)
    CONSTRAINT v2_events_longitude CHECK (longitude BETWEEN -180 AND 180),
  online_url              varchar(500),
  online_instructions     varchar(1000) NOT NULL DEFAULT '',
  organizer_name          varchar(120) NOT NULL DEFAULT '',
  organizer_logo_media_id uuid REFERENCES v2_media_assets (id) ON DELETE SET NULL,
  organizer_contact       varchar(200) NOT NULL DEFAULT '',
  booking_mode            v2_event_booking_mode NOT NULL DEFAULT 'none',
  external_booking_url    varchar(500),
  -- The partner's (Fidibo Art's) id for this event, when it has one.
  partner_ref             varchar(120) NOT NULL DEFAULT '',
  -- Places for a free registration; null is unlimited.
  capacity                integer CONSTRAINT v2_events_capacity CHECK (capacity > 0),
  status                  v2_event_status NOT NULL DEFAULT 'draft',
  publish_at              timestamptz,
  visibility              v2_event_visibility NOT NULL DEFAULT 'public',
  -- Who a restricted event is for: the ActivityAudience shape. Null otherwise.
  audience                jsonb,
  created_by              uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  updated_by              uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_events_slug_unique UNIQUE (slug),
  CONSTRAINT v2_events_time_order CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at),
  -- Anything the product can see has a publication time.
  CONSTRAINT v2_events_published_at CHECK (status IN ('draft', 'archived') OR publish_at IS NOT NULL)
);

-- Discovery: what is live, by when it starts.
CREATE INDEX v2_events_live ON v2_events (status, visibility, start_at);
-- «Not ended yet», and the calendar's ranges.
CREATE INDEX v2_events_end ON v2_events (end_at);
CREATE INDEX v2_events_city ON v2_events (lower(city));
CREATE INDEX v2_events_admin ON v2_events (updated_at DESC);

CREATE TABLE v2_event_category_links (
  event_id    uuid NOT NULL REFERENCES v2_events (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES v2_event_categories (id) ON DELETE RESTRICT,
  PRIMARY KEY (event_id, category_id)
);

CREATE INDEX v2_event_category_links_category ON v2_event_category_links (category_id);

CREATE TABLE v2_event_world_links (
  event_id uuid NOT NULL REFERENCES v2_events (id) ON DELETE CASCADE,
  world_id uuid NOT NULL REFERENCES v2_worlds (id) ON DELETE RESTRICT,
  PRIMARY KEY (event_id, world_id)
);

CREATE INDEX v2_event_world_links_world ON v2_event_world_links (world_id);

CREATE TABLE v2_event_media (
  event_id uuid NOT NULL REFERENCES v2_events (id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES v2_media_assets (id) ON DELETE RESTRICT,
  position integer NOT NULL,
  alt      varchar(200) NOT NULL DEFAULT '',
  PRIMARY KEY (event_id, media_id)
);

CREATE INDEX v2_event_media_media ON v2_event_media (media_id);

-- ─── Tickets and bookings ────────────────────────────────────────────────────

CREATE TYPE v2_ticket_availability AS ENUM ('available', 'limited', 'sold_out');

CREATE TABLE v2_event_ticket_options (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES v2_events (id) ON DELETE CASCADE,
  title        varchar(80) NOT NULL,
  description  varchar(300) NOT NULL DEFAULT '',
  -- Toman. Zero is a free ticket.
  price_toman  integer NOT NULL CONSTRAINT v2_event_ticket_options_price CHECK (price_toman >= 0),
  capacity     integer CONSTRAINT v2_event_ticket_options_capacity CHECK (capacity > 0),
  benefits     text[] NOT NULL DEFAULT '{}',
  availability v2_ticket_availability NOT NULL DEFAULT 'available',
  -- The partner's id for this ticket type, when it has one.
  external_id  varchar(120) NOT NULL DEFAULT '',
  position     integer NOT NULL DEFAULT 0
);

CREATE INDEX v2_event_ticket_options_event ON v2_event_ticket_options (event_id, position);

CREATE TABLE v2_event_interests (
  user_id        uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  event_id       uuid NOT NULL REFERENCES v2_events (id) ON DELETE CASCADE,
  remind_in_app  boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

-- «How many are interested», for the popular sort.
CREATE INDEX v2_event_interests_event ON v2_event_interests (event_id);

CREATE TYPE v2_event_booking_source AS ENUM ('internal', 'external');
CREATE TYPE v2_event_booking_status AS ENUM ('pending', 'confirmed', 'failed', 'cancelled');

CREATE TABLE v2_event_bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  event_id         uuid NOT NULL REFERENCES v2_events (id) ON DELETE CASCADE,
  ticket_option_id uuid REFERENCES v2_event_ticket_options (id) ON DELETE SET NULL,
  quantity         integer NOT NULL CONSTRAINT v2_event_bookings_quantity CHECK (quantity BETWEEN 1 AND 10),
  total_toman      integer NOT NULL DEFAULT 0 CONSTRAINT v2_event_bookings_total CHECK (total_toman >= 0),
  source           v2_event_booking_source NOT NULL,
  status           v2_event_booking_status NOT NULL,
  -- The partner's booking id, once an admin records it.
  external_ref     varchar(120) NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_event_bookings_user ON v2_event_bookings (user_id, created_at DESC);
CREATE INDEX v2_event_bookings_event ON v2_event_bookings (event_id, status);
-- One live registration, and one open handoff, per person and event.
CREATE UNIQUE INDEX v2_event_bookings_one_registration ON v2_event_bookings (user_id, event_id)
  WHERE source = 'internal' AND status = 'confirmed';
CREATE UNIQUE INDEX v2_event_bookings_one_handoff ON v2_event_bookings (user_id, event_id)
  WHERE source = 'external' AND status = 'pending';

-- ─── Audit ───────────────────────────────────────────────────────────────────

CREATE TABLE v2_event_audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity      varchar(20) NOT NULL
    CONSTRAINT v2_event_audit_log_entity CHECK (entity IN ('event', 'category', 'world', 'booking')),
  entity_id   uuid NOT NULL,
  admin_id    uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  action      varchar(40) NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_event_audit_log_entity ON v2_event_audit_log (entity, entity_id, created_at DESC);
