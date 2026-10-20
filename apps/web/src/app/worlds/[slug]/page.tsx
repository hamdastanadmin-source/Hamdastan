import type { Metadata } from 'next';

import { WorldScreen } from '@/features/worlds';
import { getWorldPage } from '@/features/worlds/server';

export const metadata: Metadata = { title: 'دنیا' };
export const dynamic = 'force-dynamic';

/** `?tab=` opens a tab of the world's menu; `?page=` a page of its list. A world that is not published is the 404 page. */
export default async function WorldPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const [{ slug }, { tab, page }] = await Promise.all([params, searchParams]);
  const pageNumber = Math.max(1, Math.trunc(Number(page)) || 1);
  return <WorldScreen page={await getWorldPage(slug, tab, pageNumber)} />;
}
