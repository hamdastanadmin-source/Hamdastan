-- ═══════════════════════════════════════════════════════════════════════════
-- 0026 — places (مکان‌ها): the environments of a world — a city map, a
-- garage, the basement under it — each with its own 3D scene, the points a
-- person interacts with, the tasks done there, and what it takes to enter.
--
--   v2_media_assets        takes 3D models: kind `model` (0025), format
--                          `glb` or `gltf`, up to 10 MB; images and motions
--                          keep their 250 KB. A new shelf, `place`.
--   v2_places              one place, under a world. A place with no parent
--                          is one of the world's maps (depth 0); a place
--                          sits at most two layers below one (depth ≤ 2).
--                          The rule is the schema's own: a child names its
--                          parent's id, world and depth in one foreign key,
--                          and its depth must be one more. A place with
--                          children cannot change depth or world, because
--                          its children's key would no longer match.
--                          `scene` (template, light, camera, the model's
--                          transform) and `access` (a level, activities to
--                          complete first) are jsonb, checked by
--                          placeInputSchema (@hamdastan/validation) on
--                          every write.
--   v2_place_hotspots      the interactive points of a place: a door or
--                          portal to another place of the same world, a
--                          task, or a note. Positioned in the scene; may be
--                          attached to a named object of the model; may be
--                          hidden until the person finds it. A place that
--                          a door leads to cannot be deleted.
--   v2_place_activities    the tasks done at a place (Engagement Studio
--                          activities), in order. An activity tied to a
--                          place opens only to someone who has reached it.
--   v2_place_visits        where a person has been, when, and the camera
--                          view they left it at.
--   v2_place_discoveries   the hidden points a person has found.
--   v2_place_trails        per person and world, the way they came: the
--                          places from a map to where they are now. «بازگشت»
--                          walks it back; a refresh opens where it ends.
--
-- Additive only: nothing existing is dropped. The library's checks on
-- v2_media_assets are replaced by wider ones that every existing row meets.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── The media library takes models ──────────────────────────────────────────

ALTER TABLE v2_media_assets
  DROP CONSTRAINT v2_media_assets_format,
  DROP CONSTRAINT v2_media_assets_kind_format,
  DROP CONSTRAINT v2_media_assets_size,
  DROP CONSTRAINT v2_media_assets_category;

ALTER TABLE v2_media_assets
  ADD CONSTRAINT v2_media_assets_format
    CHECK (format IN ('png', 'jpeg', 'webp', 'lottie', 'webm', 'mp4', 'glb', 'gltf')),
  ADD CONSTRAINT v2_media_assets_kind_format CHECK (
    (kind = 'image' AND format IN ('png', 'jpeg', 'webp')) OR
    (kind = 'motion' AND format IN ('lottie', 'webm', 'mp4')) OR
    (kind = 'model' AND format IN ('glb', 'gltf'))
  ),
  -- 250 KB, or 10 MB for a model (MEDIA_LIMITS in @hamdastan/config).
  ADD CONSTRAINT v2_media_assets_size CHECK (
    size_bytes > 0 AND (size_bytes <= 256000 OR (kind = 'model' AND size_bytes <= 10485760))
  ),
  ADD CONSTRAINT v2_media_assets_category CHECK (category IN (
    'mascot', 'cover', 'question', 'answer_motion', 'celebration', 'result', 'place', 'other'
  ));

-- ─── Places ──────────────────────────────────────────────────────────────────

CREATE TABLE v2_places (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A world with places is not deleted (the worlds repository counts them).
  world_id         uuid NOT NULL REFERENCES v2_worlds (id),
  parent_id        uuid,
  depth            smallint NOT NULL CONSTRAINT v2_places_depth_range CHECK (depth BETWEEN 0 AND 2),
  -- The parent's depth, carried so the foreign key below can check it.
  parent_depth     smallint,
  -- A key from PLACE_KINDS (@hamdastan/config).
  kind             varchar(20) NOT NULL,
  name             varchar(80) NOT NULL,
  summary          varchar(300) NOT NULL DEFAULT '',
  description      text NOT NULL DEFAULT ''
    CONSTRAINT v2_places_description_length CHECK (char_length(description) <= 4000),
  preview_media_id uuid REFERENCES v2_media_assets (id),
  cover_media_id   uuid REFERENCES v2_media_assets (id),
  -- `scene`: a 3D environment; `card`: a page with the cover, no scene.
  display          varchar(10) NOT NULL DEFAULT 'scene'
    CONSTRAINT v2_places_display CHECK (display IN ('scene', 'card')),
  model_media_id   uuid REFERENCES v2_media_assets (id),
  scene            jsonb NOT NULL DEFAULT '{}'
    CONSTRAINT v2_places_scene_object CHECK (jsonb_typeof(scene) = 'object'),
  access           jsonb NOT NULL DEFAULT '{"minLevel": null, "activityIds": []}'
    CONSTRAINT v2_places_access_object CHECK (jsonb_typeof(access) = 'object'),
  -- Order among the places that share a parent.
  position         integer NOT NULL DEFAULT 0,
  status           varchar(12) NOT NULL DEFAULT 'draft'
    CONSTRAINT v2_places_status CHECK (status IN ('draft', 'published', 'archived')),
  published_at     timestamptz,
  created_by       uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  updated_by       uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_places_identity UNIQUE (id, world_id, depth),
  -- Same world, and exactly one layer below the parent.
  CONSTRAINT v2_places_parent FOREIGN KEY (parent_id, world_id, parent_depth)
    REFERENCES v2_places (id, world_id, depth),
  CONSTRAINT v2_places_layer CHECK (
    (parent_id IS NULL AND parent_depth IS NULL AND depth = 0) OR
    (parent_id IS NOT NULL AND parent_depth IS NOT NULL AND depth = parent_depth + 1)
  )
);

CREATE INDEX v2_places_world ON v2_places (world_id, depth, position);
CREATE INDEX v2_places_parent_idx ON v2_places (parent_id);

CREATE TABLE v2_place_hotspots (
  id              uuid PRIMARY KEY,
  place_id        uuid NOT NULL REFERENCES v2_places (id) ON DELETE CASCADE,
  -- `portal`: leads to another place; `activity`: opens a task; `info`: a note.
  kind            varchar(12) NOT NULL
    CONSTRAINT v2_place_hotspots_kind CHECK (kind IN ('portal', 'activity', 'info')),
  label           varchar(60) NOT NULL,
  description     varchar(300) NOT NULL DEFAULT '',
  x               double precision NOT NULL,
  y               double precision NOT NULL,
  z               double precision NOT NULL,
  -- A named node of the place's model it is attached to: tapping it is tapping the point.
  object_name     varchar(120),
  target_place_id uuid REFERENCES v2_places (id),
  activity_id     uuid REFERENCES v2_engagement_activities (id) ON DELETE CASCADE,
  -- Not drawn until the person finds it, by tapping within `radius` of it.
  hidden          boolean NOT NULL DEFAULT false,
  radius          real NOT NULL DEFAULT 0.75
    CONSTRAINT v2_place_hotspots_radius CHECK (radius BETWEEN 0.2 AND 3),
  position        integer NOT NULL DEFAULT 0,
  CONSTRAINT v2_place_hotspots_portal CHECK ((kind = 'portal') = (target_place_id IS NOT NULL)),
  CONSTRAINT v2_place_hotspots_activity CHECK ((kind = 'activity') = (activity_id IS NOT NULL)),
  CONSTRAINT v2_place_hotspots_not_self CHECK (target_place_id IS DISTINCT FROM place_id)
);

CREATE INDEX v2_place_hotspots_place ON v2_place_hotspots (place_id, position);
CREATE INDEX v2_place_hotspots_target ON v2_place_hotspots (target_place_id) WHERE target_place_id IS NOT NULL;

CREATE TABLE v2_place_activities (
  place_id    uuid NOT NULL REFERENCES v2_places (id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES v2_engagement_activities (id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (place_id, activity_id)
);

CREATE INDEX v2_place_activities_activity ON v2_place_activities (activity_id);

-- ─── A person in a place ─────────────────────────────────────────────────────

CREATE TABLE v2_place_visits (
  user_id          uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  place_id         uuid NOT NULL REFERENCES v2_places (id) ON DELETE CASCADE,
  first_visited_at timestamptz NOT NULL DEFAULT now(),
  last_visited_at  timestamptz NOT NULL DEFAULT now(),
  -- {"position": [x, y, z], "target": [x, y, z]} — where the camera was left.
  view             jsonb,
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX v2_place_visits_place ON v2_place_visits (place_id);

CREATE TABLE v2_place_discoveries (
  user_id       uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  hotspot_id    uuid NOT NULL REFERENCES v2_place_hotspots (id) ON DELETE CASCADE,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hotspot_id)
);

CREATE INDEX v2_place_discoveries_hotspot ON v2_place_discoveries (hotspot_id);

CREATE TABLE v2_place_trails (
  user_id    uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  world_id   uuid NOT NULL REFERENCES v2_worlds (id) ON DELETE CASCADE,
  -- From a map to the current place. Ids of places since deleted are skipped on read.
  place_ids  uuid[] NOT NULL
    CONSTRAINT v2_place_trails_length CHECK (cardinality(place_ids) BETWEEN 1 AND 10),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, world_id)
);
