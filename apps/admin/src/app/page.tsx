import { redirect } from 'next/navigation';

import { requireAdminSession } from '@/features/auth/server';
import { homeFor } from '@/lib';

/** The root opens the first section the admin's role allows. */
export default async function AdminHomePage() {
  const { admin } = await requireAdminSession();
  redirect(homeFor(admin.role));
}
