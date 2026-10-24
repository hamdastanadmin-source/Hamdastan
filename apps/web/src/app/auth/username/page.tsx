import type { Metadata } from 'next';

import { UsernameForm } from '@/features/auth';
import { requireSession } from '@/features/auth/server';

export const metadata: Metadata = { title: 'انتخاب نام کاربری' };
export const dynamic = 'force-dynamic';

/**
 * Reached only through the routing table in `src/proxy.ts`, which sends an
 * account here once its basic info is in and until it has answered.
 */
export default async function UsernamePage() {
  const { user } = await requireSession();

  return <UsernameForm initialUsername={user.username ?? ''} />;
}
