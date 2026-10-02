/**
 * Onboarding — server-only surface.
 *
 * Kept apart from `./index` so a client component cannot pull `next/headers`
 * into its bundle by accident.
 */

export { getSavedInterestIds } from './services/saved-interests.service';
