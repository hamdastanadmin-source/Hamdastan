import type { Metadata } from 'next';

import { WelcomeScreen } from '@/features/auth';

export const metadata: Metadata = { title: 'خوش اومدی' };

export default function WelcomePage() {
  return <WelcomeScreen />;
}
