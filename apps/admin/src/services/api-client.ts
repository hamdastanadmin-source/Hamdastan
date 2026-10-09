import { API_BASE_URL, API_PREFIX } from '@hamdastan/config';
import { createHttpClient } from '@hamdastan/shared';

/**
 * The admin panel's only way out to the network — same rule as `apps/web`:
 * every request goes to `apps/api`, and nothing else.
 */

/**
 * A 401 on a panel call means the session is over — it expired, was signed
 * out elsewhere, or the admin was deactivated. There is nothing to refresh
 * (the admin session is a single token), so the screen goes back to sign-in.
 * A 401 from sign-in itself is about the code, not about a session.
 */
function onUnauthorized(path: string): Promise<boolean> {
  if (!path.startsWith('/admin/auth/')) window.location.assign('/login');
  return Promise.resolve(false);
}

export const apiClient = createHttpClient({
  baseUrl: `${API_BASE_URL}${API_PREFIX}`,
  credentials: 'include',
  // Only in the browser; a server render has its own redirect.
  onUnauthorized: typeof window === 'undefined' ? undefined : onUnauthorized,
});
