/**
 * Content — محتوای دنیاها
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { contentRoutes } from './content.routes';
export { contentService } from './content.service';
export { setContentRepository, type ContentRepository } from './content.repository';
