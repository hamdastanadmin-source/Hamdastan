/**
 * Admin — ورود به پنل مدیریت و مدیریت کاربران
 *
 * Public surface of the module. `app.ts` mounts the routes; `server.ts` binds
 * the repository; `middleware/authenticate-admin.ts` resolves the session.
 */

export { adminRoutes } from './admin.routes';
export { adminService } from './admin.service';
export {
  setAdminRepository,
  sqlAdminRepository,
  type AdminRepository,
} from './admin.repository';
export type { AdminRecord } from './admin.types';
