import type { Metadata } from 'next';

import { ActivityEditor } from '@/features/engagement';

export const metadata: Metadata = { title: 'فعالیت جدید' };

export default function NewActivityPage() {
  return <ActivityEditor />;
}
