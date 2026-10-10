import type { Metadata } from 'next';

import { ActivitiesScreen } from '@/features/engagement';

export const metadata: Metadata = { title: 'استودیو' };

export default function EngagementPage() {
  return <ActivitiesScreen />;
}
