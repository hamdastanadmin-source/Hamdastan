/**
 * Progress — پیشرفت و دستاوردهای کاربر
 *
 * Public surface of the module. `app.ts` mounts the routes; `server.ts`
 * binds the repository. Nothing outside reaches past this file.
 *
 * It owns the XP ledger and the level arithmetic. Missions grant through
 * `progressService.grant`; the account screen reads through `toProgress`.
 */

export { progressRoutes } from './progress.routes';
export { progressService, levelFor, toProgress } from './progress.service';
export {
  setProgressRepository,
  sqlProgressRepository,
  type ProgressRepository,
} from './progress.repository';
export type { XpReward, XpSourceType, XpTransaction } from './progress.types';
