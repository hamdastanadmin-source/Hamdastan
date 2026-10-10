import { describe, expect, it, vi } from 'vitest';

import { HttpError, createHttpClient, type RetryPolicy } from '@hamdastan/shared';
import { backoffDelay, parseRetryAfter } from '@hamdastan/shared/http';

/**
 * The transport's retry policy: what is retried, how often, how long it
 * waits, and when it stops. Delays are zeroed so the suite runs instantly,
 * except where the wait itself is under test.
 */

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const OK = { ok: true, data: 'done' };
const FAIL = (code: string) => ({ ok: false, error: { code, message: code } });

const fast: RetryPolicy = { maxAttempts: 5, baseDelayMs: 0, maxDelayMs: 0, maxRetryAfterMs: 2_000 };

function client(responses: Array<Response | Error>, policy: RetryPolicy = fast, timeoutMs?: number) {
  const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const next = responses.shift() ?? json(200, OK);
    if (next instanceof Error) throw next;
    void init;
    return next;
  });
  return {
    fetchImpl,
    api: createHttpClient({ baseUrl: 'http://api.test/v1', fetchImpl, retry: policy, timeoutMs }),
  };
}

describe('retrying', () => {
  it('stops at five attempts in total, the first included', async () => {
    const { api, fetchImpl } = client(Array.from({ length: 10 }, () => json(503, FAIL('DOWN'))));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it.each([502, 503, 504, 429])('retries a read answered %i', async (status) => {
    const { api, fetchImpl } = client([json(status, FAIL('TEMP')), json(200, OK)]);
    await expect(api.get('/x')).resolves.toBe('done');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries a read that never reached the server', async () => {
    const { api, fetchImpl } = client([new TypeError('fetch failed'), json(200, OK)]);
    await expect(api.get('/x')).resolves.toBe('done');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 404, 409, 422, 500])('never retries %i', async (status) => {
    const { api, fetchImpl } = client([json(status, FAIL('NO'))]);
    await expect(api.get('/x')).rejects.toBeInstanceOf(HttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each(['post', 'put', 'patch'] as const)('never retries a %s without an idempotency key', async (method) => {
    const { api, fetchImpl } = client([json(503, FAIL('DOWN')), json(200, OK)]);
    await expect(api[method]('/x', {})).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('never retries a delete', async () => {
    const { api, fetchImpl } = client([new TypeError('fetch failed')]);
    await expect(api.delete('/x')).rejects.toThrow('fetch failed');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a write that carries an idempotency key, sending the same key each time', async () => {
    const { api, fetchImpl } = client([new TypeError('fetch failed'), json(502, FAIL('BAD')), json(200, OK)]);
    await expect(api.post('/submit', { a: 1 }, { idempotencyKey: 'key-1' })).resolves.toBe('done');

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const keys = fetchImpl.mock.calls.map(
      ([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']
    );
    expect(keys).toEqual(['key-1', 'key-1', 'key-1']);
  });

  it('does not retry at all without a policy', async () => {
    const fetchImpl = vi.fn(async () => json(503, FAIL('DOWN')));
    const api = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });
    await expect(api.get('/x')).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('waiting', () => {
  it('waits what Retry-After says', async () => {
    vi.useFakeTimers();
    try {
      const { api, fetchImpl } = client([json(429, FAIL('SLOW'), { 'Retry-After': '1' }), json(200, OK)]);
      const pending = api.get('/x');

      await vi.advanceTimersByTimeAsync(900);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(200);
      await expect(pending).resolves.toBe('done');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up rather than wait out a Retry-After longer than the cap', async () => {
    const { api, fetchImpl } = client([json(429, FAIL('SLOW'), { 'Retry-After': '60' })]);
    await expect(api.get('/x')).rejects.toMatchObject({ status: 429, code: 'SLOW' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('backs off exponentially, with jitter, under a ceiling', () => {
    const policy = { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1_000, maxRetryAfterMs: 0 };
    expect(backoffDelay(1, policy, () => 0.999)).toBe(99);
    expect(backoffDelay(3, policy, () => 0.999)).toBe(399);
    expect(backoffDelay(10, policy, () => 0.999)).toBe(999);
    expect(backoffDelay(3, policy, () => 0)).toBe(0);
  });

  it('reads Retry-After as seconds or as a date', () => {
    expect(parseRetryAfter('3')).toBe(3_000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6_000);
    expect(parseRetryAfter('soon')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });
});

describe('timeouts and cancellation', () => {
  it('abandons an attempt that hangs, and retries a read', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          calls += 1;
          if (calls > 1) return resolve(json(200, OK));
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        })
    );
    const api = createHttpClient({ baseUrl: 'http://api.test', fetchImpl, retry: fast, timeoutMs: 20 });
    await expect(api.get('/x')).resolves.toBe('done');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('reports a timeout as a TimeoutError once attempts run out', async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        })
    );
    const api = createHttpClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      retry: { ...fast, maxAttempts: 2 },
      timeoutMs: 10,
    });
    await expect(api.get('/x')).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('stops retrying the moment the caller cancels', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort(new DOMException('left the screen', 'AbortError'));
      throw new DOMException('left the screen', 'AbortError');
    });
    const api = createHttpClient({ baseUrl: 'http://api.test', fetchImpl, retry: fast });
    await expect(api.get('/x', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
