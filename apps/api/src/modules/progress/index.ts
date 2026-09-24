/**
 * Progress — پیشرفت و دستاوردهای کاربر
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { progressRoutes } from './progress.routes';
export { progressService } from './progress.service';
export { setProgressRepository, type ProgressRepository } from './progress.repository';
