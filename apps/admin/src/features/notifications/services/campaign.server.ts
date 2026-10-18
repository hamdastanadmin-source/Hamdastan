import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { AdminCampaign } from '@hamdastan/types';

import { adminNotificationsService, HttpError } from '@/services';

/**
 * A campaign read on the server, with the request's admin cookie, so the
 * screen opens complete. A missing one is the 404 page; any other failure is
 * left to the error boundary.
 */
export async function getCampaign(id: string): Promise<AdminCampaign> {
  const cookie = (await cookies()).toString();
  try {
    return await adminNotificationsService.get(id, { cookie });
  } catch (error) {
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}
