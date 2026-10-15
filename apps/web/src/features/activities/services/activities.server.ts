import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { ActivityCard, JourneyPreview, PlayerActivity } from '@hamdastan/types';

import { activitiesService, HttpError } from '@/services';

/**
 * Activities read on the server with the request's own cookies, so the
 * screens open complete.
 */

/**
 * The person's activities, for home and the list. Home must not fail
 * because of them: if the API cannot answer, there are simply no
 * activities to show.
 */
export async function getMyActivities(): Promise<ActivityCard[]> {
  const cookie = (await cookies()).toString();
  return activitiesService.list({ cookie }).catch(() => []);
}

/** One activity to play. One the person may not see is the 404 page — never a hint that it exists. */
export async function getPlayerActivity(id: string): Promise<PlayerActivity> {
  const cookie = (await cookies()).toString();
  try {
    return await activitiesService.get(id, { cookie });
  } catch (error) {
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

/**
 * An admin's full preview of a journey. The admin's own session cookie goes
 * with it, and the API decides: anyone else — a product account included —
 * gets the 404 page.
 */
export async function getJourneyPreview(id: string): Promise<JourneyPreview> {
  const cookie = (await cookies()).toString();
  try {
    return await activitiesService.preview(id, { cookie });
  } catch (error) {
    if (error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) notFound();
    throw error;
  }
}
