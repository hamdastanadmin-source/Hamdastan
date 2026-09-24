import { API_BASE_URL, API_PREFIX } from '@hamdastan/config';
import { createHttpClient } from '@hamdastan/shared';

/**
 * The admin panel's only way out to the network — same rule as `apps/web`:
 * every request goes to `apps/api`, and nothing else.
 */
export const apiClient = createHttpClient({
  baseUrl: `${API_BASE_URL}${API_PREFIX}`,
  credentials: 'include',
});
