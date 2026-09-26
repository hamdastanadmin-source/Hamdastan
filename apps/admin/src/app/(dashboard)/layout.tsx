import { AdminShell } from '@/components';
import { requireAdmin } from '@/features/auth/server';

/**
 * Everything behind a session.
 *
 * `requireAdmin` resolves it once per request and redirects anybody who has no
 * session, whose access has run out, or who still owes a password change — so
 * no page inside this group has to check any of that for itself. It is not the
 * security boundary, though: each of these pages gets its data from `apps/api`,
 * which checks the same things again on every request.
 */

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
