/**
 * Minimal HTTP transport.
 *
 * This is plumbing only — it knows how to send a request and unwrap the
 * response envelope, and nothing about any particular endpoint. Each app
 * builds its own client on top of this in `src/services/`, which is the only
 * place allowed to name a backend route.
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

export type HttpClientOptions = {
  baseUrl: string;
  /** Merged into every request; per-call headers win. */
  headers?: Record<string, string>;
  /** Send cookies. Needed for the session cookie in the browser. */
  credentials?: RequestCredentials;
  fetchImpl?: typeof fetch;
};

export type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Opt out of Next's default caching for data that must be fresh. */
  cache?: RequestCache;
};

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

export type HttpClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
};

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const send = async <T>(
    method: string,
    path: string,
    body?: unknown,
    requestOptions: RequestOptions = {}
  ): Promise<T> => {
    const doFetch = options.fetchImpl ?? globalThis.fetch;

    const response = await doFetch(
      buildUrl(options.baseUrl, path, requestOptions.query),
      {
        method,
        credentials: options.credentials,
        cache: requestOptions.cache,
        signal: requestOptions.signal,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...options.headers,
          ...requestOptions.headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }
    );

    const payload = (await response
      .json()
      .catch(() => undefined)) as ApiResponse<T> | undefined;

    if (!response.ok || !payload || payload.ok === false) {
      throw new HttpError(
        response.status,
        payload && payload.ok === false
          ? payload.error
          : { code: 'UNKNOWN', message: response.statusText || 'Request failed' }
      );
    }

    return payload.data;
  };

  return {
    get: (path, o) => send('GET', path, undefined, o),
    post: (path, body, o) => send('POST', path, body, o),
    patch: (path, body, o) => send('PATCH', path, body, o),
    put: (path, body, o) => send('PUT', path, body, o),
    delete: (path, o) => send('DELETE', path, undefined, o),
  };
}
