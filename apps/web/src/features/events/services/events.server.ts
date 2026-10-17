import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { EventCard, EventCategory, EventDetail, MyEventsTab, Paginated, World } from '@hamdastan/types';

import { eventsService, HttpError } from '@/services';

import { toListQuery, type DiscoveryState } from '../utils/filters';

/**
 * Events read on the server with the request's own cookies, so the screens
 * open complete. A list that cannot be read is `null` — the screen says so —
 * and home simply has no events section.
 */

const cookie = async () => (await cookies()).toString();

/** A 404 or a malformed address is the 404 page — never a hint that something exists. */
function missing(error: unknown): never {
  if (error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) notFound();
  throw error;
}

export async function getDiscovery(
  state: DiscoveryState
): Promise<{ result: Paginated<EventCard> | null; categories: EventCategory[]; worlds: World[] }> {
  const options = { cookie: await cookie() };
  const [result, categories, worlds] = await Promise.all([
    eventsService.list(toListQuery(state), options).catch(() => null),
    eventsService.categories(options).catch(() => []),
    eventsService.worlds(options).catch(() => []),
  ]);
  return { result, categories, worlds };
}

export async function getEventPage(slug: string): Promise<{ event: EventDetail; related: EventCard[] }> {
  const options = { cookie: await cookie() };
  const [event, related] = await Promise.all([
    eventsService.get(slug, options).catch(missing),
    eventsService.related(slug, options).catch(() => []),
  ]);
  return { event, related };
}

/** An admin's preview: the admin's own session cookie goes with it, and the API decides. */
export async function getEventPreview(id: string): Promise<EventDetail> {
  return eventsService.preview(id, { cookie: await cookie() }).catch(missing);
}

/** Home's next few events the person can still attend; home never fails because of them. */
export async function getUpcomingEvents(): Promise<EventCard[]> {
  const options = { cookie: await cookie() };
  return eventsService.list({ available: true, page: 1, pageSize: 3 }, options).then((page) => page.items, () => []);
}

/** «رویدادهای من»: the reminders and the three tabs, read together. A tab that cannot be read is `null`. */
export async function getMyEvents(): Promise<{ soon: EventCard[]; lists: Record<Exclude<MyEventsTab, 'soon'>, EventCard[] | null> }> {
  const options = { cookie: await cookie() };
  const read = (tab: MyEventsTab) => eventsService.mine(tab, options).catch(() => null);
  const [soon, interested, booked, past] = await Promise.all([read('soon'), read('interested'), read('booked'), read('past')]);
  return { soon: soon ?? [], lists: { interested, booked, past } };
}

/** Home's in-app reminders; home never fails because of them. */
export async function getSoonEvents(): Promise<EventCard[]> {
  const options = { cookie: await cookie() };
  return eventsService.mine('soon', options).catch(() => []);
}
