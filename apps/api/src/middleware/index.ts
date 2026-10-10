/**
 * Cross-cutting request handling: things every route gets, wired once in
 * `app.ts`. Anything specific to one resource belongs in that module.
 */

export { registerErrorHandler } from './error-handler';
export { authenticate, currentUser } from './authenticate';
export { authenticateAdmin, currentAdmin, requireAdminPermission } from './authenticate-admin';
export { rateLimits, registerRateLimit } from './rate-limit';
export { registerCsrfProtection } from './csrf';
