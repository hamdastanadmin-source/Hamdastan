import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { AdminActivityDetail } from '@hamdastan/types';

import { adminEngagementService, HttpError } from '@/services';

/**
 * An activity read on the server, with the request's admin cookie, so the
 * editor opens complete. A missing one is the 404 page; any other failure
 * is left to the error boundary.
 */
export async function getActivity(id: string): Promise<AdminActivityDetail> {
  const cookie = (await cookies()).toString();
  try {
    return await adminEngagementService.get(id, { cookie });
  } catch (error) {
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}
