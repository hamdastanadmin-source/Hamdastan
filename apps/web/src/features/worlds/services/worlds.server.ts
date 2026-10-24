import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { World, WorldHome } from '@hamdastan/types';

import { contentService, eventsService, HttpError, worldsService } from '@/services';

import { hasActivities, WORLD_LIST_KINDS, type WorldActivitiesPage, type WorldHomePage, type WorldListPage } from '../utils/pages';

/**
 * Worlds read on the server with the request's own cookies, so the page
 * opens complete. A world that is not published is the 404 page; a list
 * that cannot be read says so, and the rest of the page still opens.
 */

const cookie = async () => (await cookies()).toString();

/** A 404 or a malformed address is the 404 page — never a hint that something exists. */
function missing(error: unknown): never {
  if (error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) notFound();
  throw error;
}

/** A world's home: the world, then its sections. */
export async function getWorldHome(slug: string): Promise<WorldHomePage> {
  const options = { cookie: await cookie() };
  const world = await worldsService.get(slug, options).catch(missing);
  return { world, sections: await worldsService.home(slug, options).then((home) => home.sections, () => null) };
}

/** A world's «فعالیت‌ها» menu; the 404 page when the world has it off. */
export async function getWorldActivities(slug: string): Promise<WorldActivitiesPage> {
  const options = { cookie: await cookie() };
  const world = await worldsService.get(slug, options).catch(missing);
  if (!hasActivities(world)) notFound();
  return { world, cards: await worldsService.activities(slug, options).catch(() => null) };
}

/** A home section's «همه» page: one page of the world's news, knowledge or events. Any other kind is the 404 page. */
export async function getWorldList(slug: string, askedKind: string, page: number): Promise<WorldListPage> {
  const kind = WORLD_LIST_KINDS.find((item) => item === askedKind);
  if (!kind) notFound();
  const options = { cookie: await cookie() };
  const world = await worldsService.get(slug, options).catch(missing);
  if (kind === 'events') {
    return { world, kind, page: await eventsService.list({ world: slug, sort: 'newest', page }, options).catch(() => null) };
  }
  return { world, kind, page: await contentService.articles({ world: slug, kind, page }, options).catch(() => null) };
}

/** An admin's preview of a world's home: the admin's own session cookie goes with it, and the API decides. */
export async function getWorldPreview(id: string): Promise<WorldHome> {
  return worldsService.preview(id, { cookie: await cookie() }).catch(missing);
}

/** Home's world picker: the published worlds, in order. Home never fails because of them. */
export async function getHomeWorlds(): Promise<World[]> {
  return worldsService.list({ cookie: await cookie() }).catch(() => []);
}
