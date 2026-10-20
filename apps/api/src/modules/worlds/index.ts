/**
 * Worlds — دنیاها: a world's lifecycle, identity, menu and home page.
 * Membership and following come later, with their own migration.
 *
 * Public surface of the module. `modules/index.ts` mounts the routes;
 * `server.ts` binds the repository. Nothing outside reaches past this file.
 */

export { worldsAdminRoutes, worldsRoutes } from './worlds.routes';
export { worldsService } from './worlds.service';
export { setWorldsRepository, sqlWorldsRepository, type WorldsRepository } from './worlds.repository';
