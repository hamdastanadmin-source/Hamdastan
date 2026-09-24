/**
 * Community — گروه‌ها و تعامل کاربران
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { communityRoutes } from './community.routes';
export { communityService } from './community.service';
export { setCommunityRepository, type CommunityRepository } from './community.repository';
