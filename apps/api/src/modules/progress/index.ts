/**
 * Progress — پیشرفت و دستاوردهای کاربر
 *
 * Public surface of the module. `app.ts` mounts the routes; `server.ts`
 * binds the repository. Nothing outside reaches past this file.
 *
 * It owns the XP ledger and the level arithmetic. Missions grant through
 * `progressService.grant`; Engagement Studio grants inside its own
 * transaction through `grantWithin` and revokes through
 * `progressService.revoke`; the account screen reads through `toProgress`.
 */

export { progressRoutes } from './progress.routes';
export { progressService, levelFor, toProgress } from './progress.service';
export {
  grantWithin,
  setProgressRepository,
  sqlProgressRepository,
  type ProgressRepository,
} from './progress.repository';
export type { XpReward, XpRevocation, XpSourceType, XpTransaction } from './progress.types';
