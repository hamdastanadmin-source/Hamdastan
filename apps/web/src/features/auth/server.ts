/**
 * Auth — server-only surface.
 *
 * Kept apart from `./index` so a client component cannot pull `next/headers`
 * or the session lookup into its bundle.
 */

export { getSession, requireAuth, requireAdmin } from './services/session.service';
