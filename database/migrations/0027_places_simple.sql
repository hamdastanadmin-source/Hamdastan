-- ═══════════════════════════════════════════════════════════════════════════
-- 0027 — places, simplified: a world's map is an image, the places on it are
-- pins, and each place inside is an image with its own pins and tasks. The
-- 3D scenes, interactive points, entry conditions, hidden doors and stored
-- trails of 0025/0026 are gone.
--
--   v2_places              keeps its tree (two layers below the map, the
--                          same foreign key) and its tasks. Gains where it
--                          is pinned on its parent's image (`pin_x`,
--                          `pin_y`, percent of the image's width and height
--                          from its left and top). Its one image is the old
--                          preview image (`preview_media_id` →
--                          `image_media_id`). Loses its kind, description,
--                          featured image, display, 3D model, scene and
--                          entry conditions. `archived` becomes `draft`.
--   v2_place_hotspots,     dropped: the points of a 3D scene, and each
--   v2_place_visits,       person's visits, finds and way back through
--   v2_place_discoveries,  them.
--   v2_place_trails
--   v2_media_assets        a 3D model is no longer taken: any model rows
--                          are removed (nothing can refer to one now), and
--                          the checks go back to images and motions. An
--                          image may be 512 KB; a motion stays at 250 KB.
--                          `model` stays a value of v2_media_kind, unused —
--                          PostgreSQL cannot drop an enum value.
--
-- allow-destructive: everything dropped belongs to the 3D places of 0025/0026,
-- which the product replaces with images and pins; a place keeps its name,
-- summary, tree, preview image (now its image), tasks and status.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Places ──────────────────────────────────────────────────────────────────

DROP TABLE v2_place_trails;
DROP TABLE v2_place_discoveries;
DROP TABLE v2_place_visits;
DROP TABLE v2_place_hotspots;

ALTER TABLE v2_places
  DROP COLUMN kind,
  DROP COLUMN description,
  DROP COLUMN cover_media_id,
  DROP COLUMN display,
  DROP COLUMN model_media_id,
  DROP COLUMN scene,
  DROP COLUMN access;

ALTER TABLE v2_places RENAME COLUMN preview_media_id TO image_media_id;
ALTER TABLE v2_places RENAME CONSTRAINT v2_places_preview_media_id_fkey TO v2_places_image_media_id_fkey;

-- Where it sits on its parent's image; a new place starts in the middle.
ALTER TABLE v2_places
  ADD COLUMN pin_x numeric(5, 2) NOT NULL DEFAULT 50
    CONSTRAINT v2_places_pin_x CHECK (pin_x BETWEEN 0 AND 100),
  ADD COLUMN pin_y numeric(5, 2) NOT NULL DEFAULT 50
    CONSTRAINT v2_places_pin_y CHECK (pin_y BETWEEN 0 AND 100);

UPDATE v2_places SET status = 'draft' WHERE status = 'archived';
ALTER TABLE v2_places DROP CONSTRAINT v2_places_status;
ALTER TABLE v2_places ADD CONSTRAINT v2_places_status CHECK (status IN ('draft', 'published'));

-- ─── The media library: images and motions again ─────────────────────────────

DELETE FROM v2_media_assets WHERE kind = 'model';

ALTER TABLE v2_media_assets
  DROP CONSTRAINT v2_media_assets_format,
  DROP CONSTRAINT v2_media_assets_kind_format,
  DROP CONSTRAINT v2_media_assets_size;

ALTER TABLE v2_media_assets
  ADD CONSTRAINT v2_media_assets_format
    CHECK (format IN ('png', 'jpeg', 'webp', 'lottie', 'webm', 'mp4')),
  ADD CONSTRAINT v2_media_assets_kind_format CHECK (
    (kind = 'image' AND format IN ('png', 'jpeg', 'webp')) OR
    (kind = 'motion' AND format IN ('lottie', 'webm', 'mp4'))
  ),
  -- 512 KB for an image, 250 KB for a motion (MEDIA_LIMITS in @hamdastan/config).
  ADD CONSTRAINT v2_media_assets_size CHECK (
    size_bytes > 0 AND (size_bytes <= 256000 OR (kind = 'image' AND size_bytes <= 524288))
  );
