import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { AdminPlaceDetail } from '@hamdastan/types';

import { adminPlacesService, HttpError } from '@/services';

/**
 * A place read on the server, with the request's admin cookie, so its page
 * opens complete. A missing one is the 404 page; any other failure is left
 * to the error boundary.
 */
export async function getPlace(id: string): Promise<AdminPlaceDetail> {
  const cookie = (await cookies()).toString();
  try {
    return await adminPlacesService.get(id, { cookie });
  } catch (error) {
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}
