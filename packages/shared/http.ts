/**
 * Minimal HTTP transport.
 *
 * This is plumbing only — it knows how to send a request, unwrap the
 * response envelope, give up on a request that hangs and try again when the
 * failure was temporary, and nothing about any particular endpoint. Each app
 * builds its own client on top of this in `src/services/`, which is the only
 * place allowed to name a backend route.
 *
 * ## When a request is retried
 *
 * Only when sending it twice cannot do anything twice:
 *
 *   • `GET` and `HEAD` — every one in `apps/api` is a read;
 *   • a request sent with an `idempotencyKey`, which the API records and
 *     answers a second time from that record instead of acting again.
 *
 * Nothing else, `PUT` included. A `PUT` is idempotent only when nothing else
 * happened in between: a draft save retried after a newer save would put the
 * older draft back.
 *
 * And only for a failure that is plausibly temporary: the network dropped,
 * the attempt timed out, or the API answered 502, 503, 504 or 429. A 4xx is
 * an answer, and asking again gets the same one.
 *
 * Waits are exponential with full jitter, so many clients failing together
 * do not come back together; a `Retry-After` is honoured, and one longer than
 * `maxRetryAfterMs` ends the retries rather than holding a screen. The
 * caller's `signal` cancels the attempt in flight and any wait.
 */

import type { ApiErrorBody, ApiResponse } from '@hamdastan/types';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'HttpError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export type RetryPolicy = {
  /** Tries in total, the first included. 1 disables retrying. */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxRetryAfterMs: number;
};

export type HttpClientOptions = {
  baseUrl: string;
  /** Merged into every request; per-call headers win. */
  headers?: Record<string, string>;
  /** Send cookies. Needed for the session cookie in the browser. */
  credentials?: RequestCredentials;
  fetchImpl?: typeof fetch;
  /** One attempt's limit. Unset: no limit beyond the caller's `signal`. */
  timeoutMs?: number;
  /** Unset: one attempt, as before retrying existed. */
  retry?: RetryPolicy;
  /**
   * Called once when a request is answered 401. Resolve `true` when the
   * session has been renewed, and the request is sent again — once; a second
   * 401 is thrown as usual. Safe for any method: a 401 is refused before the
   * handler runs.
   */
  onUnauthorized?: (path: string) => Promise<boolean>;
};

export type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  /** Cancels the request, and any wait between attempts. */
  signal?: AbortSignal;
  /** Opt out of Next's default caching for data that must be fresh. */
  cache?: RequestCache;
  /**
   * Lets the request outlive the page. For small fire-and-forget calls —
   * analytics — that are often sent just before a navigation or a reload,
   * which would otherwise cancel them.
   */
  keepalive?: boolean;
  /**
   * Sent as `Idempotency-Key`, and what makes a write retryable. Generate it
   * once per user action — not per attempt — so every retry of that action
   * carries the same key.
   */
  idempotencyKey?: string;
};

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

/**
 * A fresh idempotency key: 128 random bits, hex. `getRandomValues` rather
 * than `randomUUID`, which a browser offers only on a secure origin — and a
 * phone opening the dev server by its LAN address is not one.
 */
export function createIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function buildUrl(
  baseUrl: string,
  path: string,
  query: RequestOptions['query']
): string {
  const url = new URL(
    path.startsWith('/') ? path.slice(1) : path,
    baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  );
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** `Retry-After` in milliseconds — seconds or an HTTP date — or null. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/** Full jitter: anywhere between nothing and the capped exponential step. */
export function backoffDelay(attempt: number, policy: RetryPolicy, random = Math.random): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  return Math.floor(random() * ceiling);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * One attempt's signal: the caller's, plus our own timeout. Built by hand
 * rather than with `AbortSignal.any`, which older mobile browsers lack.
 */
function attemptSignal(callerSignal: AbortSignal | undefined, timeoutMs: number | undefined) {
  if (!timeoutMs) return { signal: callerSignal, timedOut: () => false, done: () => {} };

  const controller = new AbortController();
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    controller.abort(new DOMException('The request timed out', 'TimeoutError'));
  }, timeoutMs);
  const onAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) onAbort();
  callerSignal?.addEventListener('abort', onAbort, { once: true });

  return {
    signal: controller.signal,
    timedOut: () => expired,
    done: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onAbort);
    },
  };
}

export type HttpClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
};

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const doFetch = options.fetchImpl ?? globalThis.fetch;

  /** Sends until there is an answer worth returning, or no attempts left. */
  const exchange = async (
    method: string,
    path: string,
    body: unknown,
    requestOptions: RequestOptions
  ): Promise<{ response: Response; payload: ApiResponse<unknown> | undefined }> => {
    const retryable =
      method === 'GET' || method === 'HEAD' || Boolean(requestOptions.idempotencyKey);
    const policy = options.retry;
    const maxAttempts = retryable && policy ? Math.max(1, policy.maxAttempts) : 1;
    const callerSignal = requestOptions.signal;

    for (let attempt = 1; ; attempt += 1) {
      const isLast = attempt >= maxAttempts;
      const scope = attemptSignal(callerSignal, options.timeoutMs);

      let response: Response;
      try {
        response = await doFetch(buildUrl(options.baseUrl, path, requestOptions.query), {
          method,
          credentials: options.credentials,
          cache: requestOptions.cache,
          keepalive: requestOptions.keepalive,
          signal: scope.signal,
          headers: {
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(requestOptions.idempotencyKey
              ? { 'Idempotency-Key': requestOptions.idempotencyKey }
              : {}),
            ...options.headers,
            ...requestOptions.headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (error) {
        scope.done();
        // The caller gave up: stop, whatever attempt this was.
        if (callerSignal?.aborted) throw callerSignal.reason ?? error;
        if (isLast || !policy) {
          throw scope.timedOut()
            ? new DOMException('The request timed out', 'TimeoutError')
            : error;
        }
        await sleep(backoffDelay(attempt, policy), callerSignal);
        continue;
      }

      const payload = (await response
        .json()
        .catch(() => undefined)) as ApiResponse<unknown> | undefined;
      scope.done();

      if (!RETRYABLE_STATUS.has(response.status) || isLast || !policy) {
        return { response, payload };
      }

      const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
      if (retryAfter !== null && retryAfter > policy.maxRetryAfterMs) {
        return { response, payload };
      }
      await sleep(retryAfter ?? backoffDelay(attempt, policy), callerSignal);
    }
  };

  const send = async <T>(
    method: string,
    path: string,
    body?: unknown,
    requestOptions: RequestOptions = {},
    isReplay = false
  ): Promise<T> => {
    const { response, payload } = await exchange(method, path, body, requestOptions);

    if (response.status === 401 && !isReplay && (await options.onUnauthorized?.(path))) {
      return send<T>(method, path, body, requestOptions, true);
    }

    if (!response.ok || !payload || payload.ok === false) {
      throw new HttpError(
        response.status,
        payload && payload.ok === false
          ? payload.error
          : { code: 'UNKNOWN', message: response.statusText || 'Request failed' }
      );
    }

    return payload.data as T;
  };

  return {
    get: (path, o) => send('GET', path, undefined, o),
    post: (path, body, o) => send('POST', path, body, o),
    patch: (path, body, o) => send('PATCH', path, body, o),
    put: (path, body, o) => send('PUT', path, body, o),
    delete: (path, o) => send('DELETE', path, undefined, o),
  };
}
