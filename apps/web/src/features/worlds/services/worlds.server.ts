import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { World, WorldHome } from '@hamdastan/types';

import { contentService, eventsService, HttpError, worldsService } from '@/services';

import { tabOf, type WorldPage, type WorldTabContent } from '../utils/tabs';

/**
 * Worlds read on the server with the request's own cookies, so the page
 * opens complete. A world that is not published is the 404 page; a tab
 * whose list cannot be read says so, and the rest of the page still opens.
 */

const cookie = async () => (await cookies()).toString();

/** A 404 or a malformed address is the 404 page — never a hint that something exists. */
function missing(error: unknown): never {
  if (error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) notFound();
  throw error;
}

export async function getWorldPage(slug: string, askedTab: string | undefined, page: number): Promise<WorldPage> {
  const options = { cookie: await cookie() };
  const world = await worldsService.get(slug, options).catch(missing);
  const tab = tabOf(world, askedTab);
  const failed = () => null;

  let content: WorldTabContent;
  switch (tab) {
    case 'home':
      content = { tab, sections: await worldsService.home(slug, options).then((home) => home.sections, failed) };
      break;
    case 'news':
    case 'knowledge':
      content = { tab, page: await contentService.articles({ world: slug, kind: tab, page }, options).catch(failed) };
      break;
    case 'events':
      content = { tab, page: await eventsService.list({ world: slug, sort: 'newest', page }, options).catch(failed) };
      break;
    case 'activities':
      content = { tab, cards: await worldsService.activities(slug, options).catch(failed) };
      break;
  }
  return { world, content };
}

/** An admin's preview of a world's home: the admin's own session cookie goes with it, and the API decides. */
export async function getWorldPreview(id: string): Promise<WorldHome> {
  return worldsService.preview(id, { cookie: await cookie() }).catch(missing);
}

/** Home's world picker: the published worlds, in order. Home never fails because of them. */
export async function getHomeWorlds(): Promise<World[]> {
  return worldsService.list({ cookie: await cookie() }).catch(() => []);
}
