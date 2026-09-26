/**
 * Forms — server-only surface.
 *
 * Kept apart from `./index` so a client component cannot pull `next/headers`
 * into its bundle.
 */

export { loadForm, type FormAccess } from './services/forms.server';
