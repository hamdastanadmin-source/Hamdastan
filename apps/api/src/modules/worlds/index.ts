/**
 * Worlds — دنیاها و ساختار آن‌ها
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { worldsRoutes } from './worlds.routes';
export { worldsService } from './worlds.service';
export { setWorldsRepository, type WorldsRepository } from './worlds.repository';
