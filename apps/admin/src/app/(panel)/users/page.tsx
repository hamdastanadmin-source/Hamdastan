import type { Metadata } from 'next';

import { requireAdminSession } from '@/features/auth/server';
import { UsersScreen } from '@/features/users';

export const metadata: Metadata = { title: 'مدیریت کاربران' };

export default async function UsersPage() {
  // The same call as the layout's — `cache()` makes it one request.
  const { admin } = await requireAdminSession();
  return <UsersScreen currentAdminId={admin.id} />;
}
