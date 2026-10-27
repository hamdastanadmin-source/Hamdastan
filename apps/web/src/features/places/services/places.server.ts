import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { PlaceView } from '@hamdastan/types';

import { HttpError, placesService } from '@/services';

/**
 * Places read on the server with the request's cookies, so the page opens
 * complete. A place that is not shown is the 404 page.
 */
export async function getPlace(slug: string, id: string): Promise<PlaceView> {
  try {
    return await placesService.get(slug, id, { cookie: (await cookies()).toString() });
  } catch (error) {
    if (error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) notFound();
    throw error;
  }
}
