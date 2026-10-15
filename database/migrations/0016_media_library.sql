-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 — the media & motion library (کتابخانه‌ی رسانه و موشن).
--
-- Additive only: one enum, one new table. Nothing existing is changed.
--
--   v2_media_assets  one row per file in the library: what it is (kind and
--                    format, read from the file's own bytes on upload), the
--                    admin's name and shelf for it, its size and SHA-256.
--                    The bytes are not in the database: they are on the
--                    API's media volume, as '<id>-<version>.<format>'.
--                    Replacing a file writes the next version beside it and
--                    then removes the old one, so a reader never meets a
--                    half-written file; the id — which is what activities
--                    refer to — never changes.
--
-- An activity's definition refers to a file by id. Whether a file is in use
-- is read from the definitions themselves (every version, since a response
-- keeps the version it answered), so there is no join table to keep in step;
-- a file in use cannot be deleted.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE v2_media_kind AS ENUM ('image', 'motion');

CREATE TABLE v2_media_assets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       v2_media_kind NOT NULL,
  format     varchar(10) NOT NULL
    CONSTRAINT v2_media_assets_format CHECK (format IN ('png', 'jpeg', 'webp', 'lottie', 'webm', 'mp4')),
  category   varchar(20) NOT NULL
    CONSTRAINT v2_media_assets_category CHECK (category IN (
      'mascot', 'cover', 'question', 'answer_motion', 'celebration', 'result', 'other'
    )),
  name       varchar(120) NOT NULL,
  -- 250 KB, the library's limit (MEDIA_LIMITS.MAX_BYTES).
  size_bytes integer NOT NULL
    CONSTRAINT v2_media_assets_size CHECK (size_bytes > 0 AND size_bytes <= 256000),
  sha256     char(64) NOT NULL,
  version    integer NOT NULL DEFAULT 1 CONSTRAINT v2_media_assets_version CHECK (version > 0),
  created_by uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- An image is png/jpeg/webp; a motion is lottie/webm/mp4.
  CONSTRAINT v2_media_assets_kind_format CHECK (
    (kind = 'image' AND format IN ('png', 'jpeg', 'webp')) OR
    (kind = 'motion' AND format IN ('lottie', 'webm', 'mp4'))
  )
);

CREATE INDEX v2_media_assets_shelf ON v2_media_assets (category, created_at DESC);
