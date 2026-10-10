/**
 * The admin panel's sign-in and listing numbers.
 *
 * Here rather than in `apps/api` because `apps/admin` reads the cookie name
 * (to forward it when rendering on the server) and pages with the same size
 * the API defaults to.
 */

export const ADMIN_SESSION = {
  /**
   * One opaque token, `httpOnly`. A different name from the product's
   * `hd_at`/`hd_rt`: on `localhost` cookies are shared across ports, and the
   * two sessions must never be mistaken for each other.
   */
  COOKIE: 'hd_admin',
  /** Fixed, not rolling: an operator signs in again every working day. */
  TTL_SECONDS: 12 * 60 * 60,
  /** Unused for this long, a session ends — whatever is left of the twelve hours. */
  IDLE_TIMEOUT_SECONDS: 2 * 60 * 60,
} as const;

export const ADMIN_USERS_PAGE_SIZE = 20;
