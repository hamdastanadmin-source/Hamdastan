import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { normalizeIranMobile } from '@hamdastan/shared/format/persian';

import { OtpForm } from '@/features/auth';

export const metadata: Metadata = { title: 'کد تأیید' };

/**
 * The number is carried here in the query string rather than in memory, so
 * the screen survives a reload — the code has been sent to a phone the user
 * may be picking up, and coming back to a blank form would mean asking for
 * another one.
 *
 * It is re-normalised on arrival: a hand-edited URL is just another
 * untrusted input, and an unparseable one goes back to the start.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;
  const normalized = phone ? normalizeIranMobile(phone) : null;
  if (!normalized) redirect('/auth/phone');

  return <OtpForm phone={normalized} />;
}
