import type { Metadata } from 'next';

import { LandingScreen } from '@/features/landing';

export const metadata: Metadata = { title: 'پاترهدی؟ اینجا جای توئه' };

export default function LandingPage() {
  return <LandingScreen />;
}
