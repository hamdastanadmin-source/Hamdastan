import type { Metadata } from 'next';

import { HelpScreen } from '@/features/profile';

export const metadata: Metadata = { title: 'راهنما و پشتیبانی' };

export default function HelpPage() {
  return <HelpScreen />;
}
