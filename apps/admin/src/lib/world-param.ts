const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `?world=<id>` on a «new» page — set when it is opened from a world's page
 * — or nothing when it is absent or not an id. The API checks the world
 * exists when the item is saved.
 */
export const worldIdParam = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' && UUID.test(value) ? value : undefined;
