import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { WORLD_TABS, WorldScreen } from '@/features/worlds';
import { getWorld } from '@/features/worlds/server';

export const metadata: Metadata = { title: 'مدیریت دنیا' };

/** `?tab=home` opens a tab directly. */
export default async function WorldPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  // Read access is enough to open it; changes are hidden without `worlds.manage`, and refused by the API.
  await requireAdminPermission('worlds.read');
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const world = await getWorld(id);
  return <WorldScreen key={world.id} initial={world} initialTab={WORLD_TABS.find((item) => item === tab) ?? 'identity'} />;
}
