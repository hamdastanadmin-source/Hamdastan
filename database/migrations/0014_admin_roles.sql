-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 — admin roles
--
-- Additive only: one enum and one column with a default. No admin loses
-- access: every existing admin becomes SYSTEM_ADMIN, which is exactly what
-- they could do before (everything).
--
-- The role decides *permissions*, and the permission table is code
-- (ADMIN_ROLE_PERMISSIONS in @hamdastan/types), enforced per route by
-- `requireAdminPermission` in apps/api. The column default exists only so
-- this file can add a NOT NULL column to a populated table; the API always
-- writes the role an admin is created with.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE v2_admin_role AS ENUM ('SYSTEM_ADMIN', 'CONTENT_MANAGER', 'MISSION_REVIEWER');

ALTER TABLE v2_admin_users
  ADD COLUMN role v2_admin_role NOT NULL DEFAULT 'SYSTEM_ADMIN';
