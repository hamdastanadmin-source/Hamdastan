import type { Metadata } from 'next';

import { APP_NAME } from '@hamdastan/config';

import { ChangePasswordForm } from '@/features/auth';
import { requirePasswordChange } from '@/features/auth/server';

/**
 * Entry point for `/change-password`.
 *
 * Outside the dashboard layout on purpose: an admin who still owes a change
 * cannot be shown a shell whose every link leads somewhere the backend will
 * refuse. `requirePasswordChange` sends anybody who owes nothing back to the
 * dashboard.
 */

export const metadata: Metadata = {
  title: `تغییر رمز عبور | پنل مدیریت ${APP_NAME}`,
};

export const dynamic = 'force-dynamic';

export default async function AdminChangePasswordPage() {
  await requirePasswordChange();

  return <ChangePasswordForm />;
}
