/**
 * Auth — ورود، خروج و نشست کاربر
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { authRoutes } from './auth.routes';
export { authService } from './auth.service';
export { setAuthRepository, type AuthRepository } from './auth.repository';
