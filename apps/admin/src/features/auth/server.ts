/**
 * Auth — server-only surface. Kept apart from `./index` so a client
 * component cannot pull `next/headers` into its bundle.
 */

export { getAdminSession, requireAdminSession } from './services/session.service';
