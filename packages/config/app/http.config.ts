/**
 * How the front-end apps talk to `apps/api` when the network misbehaves.
 *
 * Shared by `apps/web` and `apps/admin`, which both build their client from
 * `createHttpClient` in `@hamdastan/shared`. The rules that decide *whether*
 * a request may be retried live there; these are only the numbers.
 */
export const HTTP_RETRY = {
  /** Tries in total, the first one included. */
  MAX_ATTEMPTS: 5,
  /** Exponential backoff with full jitter: a random wait up to base × 2ⁿ… */
  BASE_DELAY_MS: 300,
  /** …never more than this. */
  MAX_DELAY_MS: 5_000,
  /**
   * A `Retry-After` longer than this is not waited out: the error reaches the
   * screen, which can say "try again in a minute" better than a spinner can.
   */
  MAX_RETRY_AFTER_MS: 10_000,
} as const;

export const HTTP_TIMEOUT = {
  /** One attempt from the browser, which may be on a slow mobile network. */
  BROWSER_MS: 15_000,
  /**
   * One attempt from the Next server to the API on the same host. Short,
   * because `proxy.ts` waits on it before every navigation.
   */
  SERVER_MS: 5_000,
  /** The server retries less: a page is waiting on it. */
  SERVER_MAX_ATTEMPTS: 2,
} as const;
