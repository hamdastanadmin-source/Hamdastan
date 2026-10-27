const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A place of a world. Named once, because a place is linked to from its
 * world's home, from the place it is pinned on and from its tasks.
 */
export const placePath = (slug: string, id: string) => `/worlds/${slug}/places/${id}`;

/** An activity opened at a place: the player, with the way back to it. */
export const placeActivityPath = (activityId: string, slug: string, placeId: string) =>
  `/activities/${activityId}?place=${placeId}&world=${slug}`;

/** `?place=<id>&world=<slug>` on an activity's address: it was opened at that place. Anything malformed is nothing. */
export function placeParam(params: { place?: string | string[]; world?: string | string[] }): { slug: string; id: string } | null {
  const { place, world } = params;
  return typeof place === 'string' && typeof world === 'string' && UUID.test(place) && SLUG.test(world) ? { slug: world, id: place } : null;
}
