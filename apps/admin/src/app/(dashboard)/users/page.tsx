import type { Metadata } from 'next';

import { APP_NAME } from '@hamdastan/config';

import { requirePermission } from '@/features/auth/server';
import { UsersScreen } from '@/features/users';
import { listAdminUsers } from '@/features/users/server';

/**
 * Entry point for `/users`.
 *
 * It does three things and no more: check that this admin may be here, read the
 * query string, and hand the page of data to the feature. The permission check
 * decides whether the screen renders; `apps/api` decides whether the data comes
 * back, and it checks `users.view` again.
 */

export const metadata: Metadata = {
  title: `مدیریت کاربران | پنل مدیریت ${APP_NAME}`,
};

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await requirePermission('users.view');

  const { search = '', page } = await searchParams;
  const parsedPage = Number(page);

  const users = await listAdminUsers({
    ...(search ? { search } : {}),
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  });

  return <UsersScreen page={users} search={search} />;
}
