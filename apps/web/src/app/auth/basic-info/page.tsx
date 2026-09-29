import type { Metadata } from 'next';

import { BasicInfoForm } from '@/features/auth';

export const metadata: Metadata = { title: 'تکمیل اطلاعات' };

/**
 * Reached only through the routing table in `src/middleware.ts`, which sends
 * anyone whose profile is incomplete here and lets nobody else in.
 */
export default function BasicInfoPage() {
  return <BasicInfoForm />;
}
