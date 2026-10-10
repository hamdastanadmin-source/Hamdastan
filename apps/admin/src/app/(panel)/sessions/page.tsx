import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { SessionsScreen } from '@/features/sessions';

export const metadata: Metadata = { title: 'نشست‌های کاربران' };

export default async function SessionsPage() {
  await requireAdminPermission('sessions.manage');
  return <SessionsScreen />;
}
