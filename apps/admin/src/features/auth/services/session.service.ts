import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { ADMIN_SESSION } from '@hamdastan/config';
import type { AdminPermission, AdminSessionResponse } from '@hamdastan/types';

import { can, homeFor } from '@/lib';
import { adminAuthService } from '@/services';

/**
 * The admin session, read on the server by forwarding the request's cookies
 * to `GET /admin/me`. The API is what decides; this redirect only spares an
 * outsider the sight of an empty panel — every panel call is checked again
 * in `apps/api`.
 *
 * Deduplicated per request by `cache()`, so the layout and the page share
 * one call.
 */
export const getAdminSession = cache(async (): Promise<AdminSessionResponse | null> => {
  const cookieStore = await cookies();
  if (!cookieStore.get(ADMIN_SESSION.COOKIE)) return null;

  try {
    return await adminAuthService.getSession({ cookie: cookieStore.toString() });
  } catch {
    // 401 (expired, revoked, deactivated) or the API being down: either way
    // there is no session to render the panel with.
    return null;
  }
});

export async function requireAdminSession(): Promise<AdminSessionResponse> {
  const session = await getAdminSession();
  if (!session) redirect('/login');
  return session;
}

/**
 * A page only some roles may open. Without the permission, the admin is
 * sent to the first section they do have, instead of a page whose every
 * call would answer 403.
 */
export async function requireAdminPermission(permission: AdminPermission): Promise<AdminSessionResponse> {
  const session = await requireAdminSession();
  if (!can(session.admin.role, permission)) redirect(homeFor(session.admin.role));
  return session;
}
