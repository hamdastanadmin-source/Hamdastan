import { cookies } from 'next/headers';

import type { AccountOverview } from '@hamdastan/types';

import { accountService } from '@/services';

/**
 * The account hub as `apps/api` holds it, read on the server so every
 * account screen opens complete — no empty flash, no client-side fetch on
 * arrival. A failure is left to the error boundary rather than shown as an
 * empty profile.
 */
export async function getAccountOverview(): Promise<AccountOverview> {
  const cookie = (await cookies()).toString();
  return accountService.getOverview({ cookie });
}
