import { API_BASE_URL, API_PREFIX } from '@hamdastan/config';
import { createHttpClient } from '@hamdastan/shared';

/**
 * The web app's only way out to the network.
 *
 * Every request the app makes goes through this client to `apps/api`. The
 * front-end never calls a third-party service, a database or an external API
 * directly — if the product needs one, the backend fronts it and exposes it
 * as a route here.
 *
 * Endpoints are named in the service module next to this one, never in a
 * component. Components call a service; services call this.
 */
export const apiClient = createHttpClient({
  baseUrl: `${API_BASE_URL}${API_PREFIX}`,
  // Carries the session cookie on browser-side calls.
  credentials: 'include',
});
