-- ═══════════════════════════════════════════════════════════════════════════
-- 0025 — 3D models in the media library (مدل سه‌بعدی), for places.
--
-- Additive only: one new value of v2_media_kind. The formats, the size a
-- model may have and the shelf it is filed on are 0026's, because the new
-- value cannot be used inside the transaction that adds it (PostgreSQL
-- refuses that) — the same split as 0021.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE v2_media_kind ADD VALUE 'model';
