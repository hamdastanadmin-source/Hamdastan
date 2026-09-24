/**
 * Missions — ماموریت‌ها
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { missionsRoutes } from './missions.routes';
export { missionsService } from './missions.service';
export { setMissionsRepository, type MissionsRepository } from './missions.repository';
