/**
 * Admin auth — ورود مدیران با نام کاربری و رمز عبور
 *
 * Public surface of the module. `app.ts` mounts the routes and binds the
 * repository; `middleware/admin-guard.ts` uses the service to protect every
 * other admin route. Nothing outside reaches past this file, except the two
 * leaf files `admin-users` imports by path — see `docs/ARCHITECTURE.md`.
 */

export { adminAuthRoutes } from './admin-auth.routes';
export { adminAuthService } from './admin-auth.service';
export {
  setAdminAuthRepository,
  createInMemoryAdminAuthRepository,
  type AdminAuthRepository,
} from './admin-auth.repository';
export type { AdminAuthorization } from './admin-auth.types';
