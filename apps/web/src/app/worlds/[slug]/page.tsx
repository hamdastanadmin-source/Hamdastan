import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { WorldHomeScreen } from '@/features/worlds';
import { getWorldHome } from '@/features/worlds/server';

export const metadata: Metadata = { title: 'دنیا' };
export const dynamic = 'force-dynamic';

/**
 * A world's home. A world that is not published is the 404 page. `?tab=` is
 * the address the world's sections had when they were tabs; a shared link
 * still lands on the page that replaced it.
 */
export default async function WorldPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, { tab }] = await Promise.all([params, searchParams]);
  if (tab === 'activities' || tab === 'news' || tab === 'knowledge' || tab === 'events') redirect(`/worlds/${slug}/${tab}`);
  return <WorldHomeScreen page={await getWorldHome(slug)} />;
}
