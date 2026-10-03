import type { Metadata } from 'next';

import { SettingsScreen } from '@/features/profile';
import { getAccountOverview } from '@/features/profile/server';

export const metadata: Metadata = { title: 'تنظیمات' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { settings } = await getAccountOverview();
  return <SettingsScreen settings={settings} />;
}
