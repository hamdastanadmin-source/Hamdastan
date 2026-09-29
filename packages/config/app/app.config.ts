/**
 * Application-wide constants shared by every app in the monorepo.
 *
 * Anything here must hold true for `apps/web`, `apps/admin` and `apps/api`
 * alike. App-specific configuration belongs in that app, not in this file.
 */

export const APP_NAME = 'هم‌دستان';
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
 *
 * The two sides of a Next app reach the same backend by different routes, so
 * they read different variables:
 *
 *   • Server-side (rendering, route handlers) prefers `API_BASE_URL`, which
 *     on a container network is the internal name — `http://api:4000`. That
 *     call never leaves the host.
 *   • The browser can only use `NEXT_PUBLIC_API_BASE_URL`, a URL reachable
 *     from outside. `NEXT_PUBLIC_` variables are substituted into the bundle
 *     at *build* time, so this one has to be a build argument to the image;
 *     setting it only at run time leaves the default baked in.
 *
 * No `typeof window` test is needed to tell them apart. A variable without
 * the `NEXT_PUBLIC_` prefix is never exposed to a client bundle, so
 * `API_BASE_URL` is simply undefined in the browser and the order below
 * resolves itself: the internal URL on the server, the public one in the
 * browser, localhost in neither.
 */
export const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  `http://localhost:${DEFAULT_PORTS.api}`;

/** Prefix every backend route is mounted under. */
export const API_PREFIX = '/api/v1';
