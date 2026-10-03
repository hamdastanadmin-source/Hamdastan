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

let refreshing: Promise<boolean> | null = null;

/**
 * Renews the session when a browser call finds its access token expired.
 *
 * `proxy.ts` renews it on every navigation, but a screen that stays open —
 * the questionnaire is one page of many steps — outlives the fifteen-minute
 * access token without navigating. The refresh cookie is `httpOnly`, so the
 * browser sends it and receives the rotated pair without this code ever
 * seeing a token.
 *
 * Calls that fail together share one refresh: a refresh token is single-use,
 * and the API revokes the whole session when one is presented twice.
 */
function refreshOnce(path: string): Promise<boolean> {
  // A 401 from sign-in itself is about the code, not about a session.
  if (path.startsWith('/auth/')) return Promise.resolve(false);

  refreshing ??= fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
    .then((response) => {
      // The API answered and refused: the session is over — expired,
      // revoked, or from another database. Retrying the screen's action
      // cannot help, so go and sign in again; `proxy.ts` clears the dead
      // cookies on the way.
      if (response.status === 401) window.location.assign('/welcome');
      return response.ok;
    })
    // The API did not answer at all. That says nothing about the session;
    // the original error reaches the screen as usual.
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

export const apiClient = createHttpClient({
  baseUrl: `${API_BASE_URL}${API_PREFIX}`,
  // Carries the session cookie on browser-side calls.
  credentials: 'include',
  // Only in the browser. On the server there is no cookie jar to put the
  // rotated cookies in; `proxy.ts` has already renewed them for this request.
  onUnauthorized: typeof window === 'undefined' ? undefined : refreshOnce,
});
