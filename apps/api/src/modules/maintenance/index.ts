/**
 * Maintenance — the cleanup job.
 *
 * A module with no routes: nothing about it is reachable over HTTP. Its
 * service only composes the purges other modules own (`auth`, `admin`),
 * plus the idempotency record, which no module owns. `server.ts` binds the
 * repository and starts the timer.
 */

export { maintenanceService, type MaintenanceReport } from './maintenance.service';
export {
  setMaintenanceRepository,
  sqlMaintenanceRepository,
  type MaintenanceRepository,
} from './maintenance.repository';
