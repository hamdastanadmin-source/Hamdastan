/**
 * Auth — server-only surface.
 *
 * Kept apart from `./index` so a client component cannot pull the session
 * read (and `next/headers` with it) into its bundle by accident.
 */

export { getSession, requireSession, requireAdmin } from './services/session.service';
