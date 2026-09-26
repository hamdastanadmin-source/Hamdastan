import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { APP_NAME } from '@hamdastan/config';

import { AdminLoginForm } from '@/features/auth';
import { getAdminSession } from '@/features/auth/server';

/**
 * Entry point for `/login`. It answers one question — is anybody already
 * signed in? — and otherwise hands over to the feature.
 */

export const metadata: Metadata = {
  title: `ورود | پنل مدیریت ${APP_NAME}`,
};

/** The session is read per request, so this page can never be prerendered. */
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const admin = await getAdminSession();

  if (admin) {
    // An admin who still owes a password change has exactly one destination.
    redirect(admin.mustChangePassword ? '/change-password' : '/');
  }

  return <AdminLoginForm />;
}
