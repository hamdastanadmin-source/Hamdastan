/**
 * Reading the admin list while rendering on the server.
 *
 * Server-only: it forwards the session cookie out of the incoming request,
 * which `next/headers` is the only way to reach. Exported through the feature's
 * `server.ts` so a client component cannot pull it into a bundle.
 *
 * The permission is not checked here — `requirePermission` in the auth feature
 * decides whether the page renders, and `apps/api` decides whether the data
 * comes back. This only asks.
 */

import type { AdminUser, AdminUsersQuery, Paginated } from '@hamdastan/types';

import { adminSessionHeaders } from '@/lib/server-request';

import { adminUsersApi } from './admin-users.api';

export async function listAdminUsers(
  query: AdminUsersQuery
): Promise<Paginated<AdminUser>> {
  return adminUsersApi.list(query, await adminSessionHeaders());
}
