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
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  `http://localhost:${DEFAULT_PORTS.api}`;

/** Prefix every backend route is mounted under. */
export const API_PREFIX = '/api/v1';
