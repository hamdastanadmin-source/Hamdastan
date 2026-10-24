import type { Metadata } from 'next';

import { WorldListScreen } from '@/features/worlds';
import { getWorldList } from '@/features/worlds/server';

export const metadata: Metadata = { title: 'دنیا' };
export const dynamic = 'force-dynamic';

/** A home section's «همه»: `news`, `knowledge` or `events`, `?page=` a page of it. Anything else is the 404 page. */
export default async function WorldListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; kind: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ slug, kind }, { page }] = await Promise.all([params, searchParams]);
  const pageNumber = Math.max(1, Math.trunc(Number(page)) || 1);
  return <WorldListScreen list={await getWorldList(slug, kind, pageNumber)} />;
}
