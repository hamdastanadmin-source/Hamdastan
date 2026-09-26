/**
 * Admin auth — server-only surface.
 *
 * Kept apart from `./index` so a client component cannot pull `next/headers`
 * or the session lookup into its bundle.
 */

export {
  getAdminSession,
  requireAdmin,
  requirePasswordChange,
  requirePermission,
} from './services/admin-session.service';
