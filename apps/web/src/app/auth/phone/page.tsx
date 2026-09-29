import type { Metadata } from 'next';

import { PhoneForm } from '@/features/auth';

export const metadata: Metadata = { title: 'ورود با شماره موبایل' };

export default function PhonePage() {
  return <PhoneForm />;
}
