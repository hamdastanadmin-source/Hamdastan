import { AdminShell } from '@/components';
import { requireAdminSession } from '@/features/auth/server';

/**
 * Every signed-in page. No session — or a deactivated admin — goes to the
 * sign-in page before anything renders. The API checks every call again.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdminSession();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
