/**
 * Engagement — Engagement Studio: surveys, missions and assessments that the
 * admin panel designs and the product plays, and the XP they pay.
 *
 * Public surface of the module. `modules/index.ts` mounts the two route
 * plugins; `server.ts` binds the repository. The reward goes into the XP
 * ledger owned by Progress — `engagement → progress`, one way.
 */

export { engagementAdminRoutes, engagementRoutes } from './engagement.routes';
export { engagementService } from './engagement.service';
export { earnsXp, scoreAssessment } from './engagement.scoring';
export {
  setEngagementRepository,
  sqlEngagementRepository,
  type EngagementRepository,
} from './engagement.repository';
