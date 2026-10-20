/**
 * Content — محتوای دنیاها: news items and knowledge articles filed under
 * worlds, and the panel's central index of everything filed under them.
 *
 * Public surface of the module. `modules/index.ts` mounts the routes;
 * `server.ts` binds the repository. Nothing outside reaches past this file.
 */

export { contentAdminRoutes, contentRoutes } from './content.routes';
export { contentService } from './content.service';
export { setContentRepository, sqlContentRepository, type ContentRepository } from './content.repository';
