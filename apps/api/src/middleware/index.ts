/**
 * Cross-cutting request handling: things every route gets, wired once in
 * `app.ts`. Anything specific to one resource belongs in that module.
 */

export { registerErrorHandler } from './error-handler';
