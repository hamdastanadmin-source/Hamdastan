/**
 * Forms — server-only surface.
 *
 * Kept apart from `./index` so a client component cannot pull `next/headers`
 * into its bundle.
 */

export {
  loadForm,
  loadFormsDashboard,
  loadResponses,
} from './services/forms.server';
