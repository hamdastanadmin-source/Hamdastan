import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { AdminWorldDetail } from '@hamdastan/types';

import { adminWorldsService, HttpError } from '@/services';

/**
 * A world read on the server, with the request's admin cookie, so its page
 * opens complete. A missing one is the 404 page; any other failure is left
 * to the error boundary.
 */
export async function getWorld(id: string): Promise<AdminWorldDetail> {
  const cookie = (await cookies()).toString();
  try {
    return await adminWorldsService.get(id, { cookie });
  } catch (error) {
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}
