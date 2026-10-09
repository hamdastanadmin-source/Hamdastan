/**
 * Auth — ورود، خروج و نشست کاربر
 *
 * Public surface of the module. `app.ts` mounts the routes; `server.ts` binds
 * the repository and the SMS sender. Nothing outside reaches past this file.
 */

export { authRoutes } from './auth.routes';
export { authService, setSmsSender, type OtpPurpose } from './auth.service';
export {
  setAuthRepository,
  sqlAuthRepository,
  type AuthRepository,
} from './auth.repository';
