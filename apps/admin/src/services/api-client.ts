import { API_BASE_URL, API_PREFIX, HTTP_RETRY, HTTP_TIMEOUT } from '@hamdastan/config';
import { createHttpClient } from '@hamdastan/shared';

import { withBasePath } from '@/lib';

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
  if (!path.startsWith('/admin/auth/')) window.location.assign(withBasePath('/login'));
  return Promise.resolve(false);
}

const onServer = typeof window === 'undefined';

export const apiClient = createHttpClient({
  baseUrl: `${API_BASE_URL}${API_PREFIX}`,
  credentials: 'include',
  // Same policy as `apps/web`: only reads, and writes carrying an
  // idempotency key, are ever retried — see `@hamdastan/shared/http`.
  timeoutMs: onServer ? HTTP_TIMEOUT.SERVER_MS : HTTP_TIMEOUT.BROWSER_MS,
  retry: {
    maxAttempts: onServer ? HTTP_TIMEOUT.SERVER_MAX_ATTEMPTS : HTTP_RETRY.MAX_ATTEMPTS,
    baseDelayMs: HTTP_RETRY.BASE_DELAY_MS,
    maxDelayMs: HTTP_RETRY.MAX_DELAY_MS,
    maxRetryAfterMs: HTTP_RETRY.MAX_RETRY_AFTER_MS,
  },
  // Only in the browser; a server render has its own redirect.
  onUnauthorized: onServer ? undefined : onUnauthorized,
});
