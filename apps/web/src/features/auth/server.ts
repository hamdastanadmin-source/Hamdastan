/**
 * Auth — server-only surface.
 *
 * Kept apart from `./index` so a client component cannot pull the session
 * store into its bundle by accident.
 */

export { getSession, requireAuth, requireAdmin } from './services/session.service';
