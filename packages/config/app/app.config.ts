/**
 * Application-wide constants shared by every app in the monorepo.
 *
 * Anything here must hold true for `apps/web`, `apps/admin` and `apps/api`
 * alike. App-specific configuration belongs in that app, not in this file.
 */

export const APP_NAME = 'هم‌داستان';
export const APP_SLUG = 'hamdastan';

/** Default ports each app listens on in development. */
export const DEFAULT_PORTS = {
  web: 3000,
  admin: 3001,
  api: 4000,
} as const;

/**
 * Base URL of the backend API.
 *
 * The web and admin apps reach the backend only through this URL — no app
 * talks to a third-party service or a data store directly.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  `http://localhost:${DEFAULT_PORTS.api}`;

/**
 * Where the product itself is served.
 *
 * The admin panel needs it to build the link a published form is answered at
 * (`{WEB_BASE_URL}/forms/{id}`) — the form lives in the product, not in the
 * panel. Same shape as `API_BASE_URL`: the public variable is what the browser
 * sees.
 */
export const WEB_BASE_URL =
  process.env.NEXT_PUBLIC_WEB_BASE_URL ??
  process.env.WEB_BASE_URL ??
  `http://localhost:${DEFAULT_PORTS.web}`;

/** Prefix every backend route is mounted under. */
export const API_PREFIX = '/api/v1';

/**
 * Name of the session cookie.
 *
 * `apps/api` sets and clears it; the front-end apps read it server-side to
 * forward the session when they render. Both sides have to agree on the name,
 * so it is spelled once, here.
 */
export const SESSION_COOKIE_NAME = 'session';

/**
 * Name of the admin panel's session cookie.
 *
 * Deliberately a different cookie from `SESSION_COOKIE_NAME`: an admin session
 * and a product session are separate things with separate lifetimes, and one
 * browser may hold both — signing out of the product must not sign anybody out
 * of the panel, or the reverse.
 */
export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
