/**
 * Cross-cutting request handling: things every route gets, wired once in
 * `app.ts`, plus the guards a route opts into. Anything specific to one
 * resource belongs in that module.
 */

export { registerErrorHandler } from './error-handler';
export { requireAdmin } from './admin-guard';
export { attachSessionUser } from './session-user';
