import { cookies } from 'next/headers';

import { ADMIN_SESSION_COOKIE_NAME } from '@hamdastan/config';

/**
 * Forwarding the admin's session while rendering on the server.
 *
 * In the browser the cookie rides along on its own — `apiClient` sends
 * credentials. On the server there is no browser, so the token has to be copied
 * out of the incoming request and onto the outgoing one by hand.
 *
 * Server-only: it reads `next/headers`, so it is imported from a feature's
 * `server.ts` side and never from a client component.
 */
export async function adminSessionHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return token ? { cookie: `${ADMIN_SESSION_COOKIE_NAME}=${token}` } : {};
}
