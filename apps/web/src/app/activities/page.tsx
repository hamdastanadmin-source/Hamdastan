import type { Metadata } from 'next';

import { ActivitiesScreen } from '@/features/activities';
import { getMyActivities } from '@/features/activities/server';

export const metadata: Metadata = { title: 'فعالیت‌ها' };
export const dynamic = 'force-dynamic';

export default async function ActivitiesPage() {
  return <ActivitiesScreen cards={await getMyActivities()} />;
}
