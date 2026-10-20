/**
 * Worlds — server-only surface. Kept apart from `./index` so a client
 * component cannot pull `next/headers` into its bundle.
 */

export { getHomeWorlds, getWorldPage, getWorldPreview } from './services/worlds.server';
