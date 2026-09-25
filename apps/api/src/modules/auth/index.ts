/**
 * Auth — ورود با شماره موبایل و کد یک‌بارمصرف
 *
 * Public surface of the module. `app.ts` mounts the routes and binds the
 * repository. Nothing outside reaches past this file.
 */

export { authRoutes } from './auth.routes';
export { authService } from './auth.service';
export {
  setAuthRepository,
  createInMemoryAuthRepository,
  type AuthRepository,
} from './auth.repository';
