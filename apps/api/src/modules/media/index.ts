/**
 * Media — the media & motion library: images and motions an admin uploads
 * once and activities refer to by id.
 *
 * Public surface of the module. `modules/index.ts` mounts the two route
 * plugins; `server.ts` binds the repository and the storage. Engagement
 * reads it (`engagement → media`, one way) to check the ids a definition
 * names and to tell the player what they are.
 */

export { mediaAdminRoutes, mediaRoutes } from './media.routes';
export { mediaService, setMediaStorage } from './media.service';
export { sniffMedia } from './media.sniff';
export { setMediaRepository, sqlMediaRepository, type MediaRepository } from './media.repository';
