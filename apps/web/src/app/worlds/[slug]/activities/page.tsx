import type { Metadata } from 'next';

import { WorldActivitiesScreen } from '@/features/worlds';
import { getWorldActivities } from '@/features/worlds/server';

export const metadata: Metadata = { title: 'فعالیت‌های دنیا' };
export const dynamic = 'force-dynamic';

/** A world's «فعالیت‌ها» menu. The 404 page when the world is not published or has the menu off. */
export default async function WorldActivitiesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <WorldActivitiesScreen page={await getWorldActivities(slug)} />;
}
