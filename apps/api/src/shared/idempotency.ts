import type { FastifyRequest } from 'fastify';

import { sha256 } from './crypto';
import { ValidationError } from './errors';

/**
 * The HTTP half of idempotency: reading the key and fingerprinting the
 * request it came with. The record itself is `data/idempotency.ts`.
 */

/** Which key, sent by whom, for what — the identity of one retryable write. */
export type IdempotencyRef = {
  /** What the key is for, e.g. `engagement.submit`. */
  scope: string;
  ownerId: string;
  key: string;
  /** `requestHash(...)` of the request the key was sent with. */
  requestHash: string;
};

/** What a key already used recorded — or that it was used for something else. */
export type StoredIdempotency<T> =
  | { state: 'replay'; outcome: T }
  | { state: 'mismatch' };

/** How long a key is remembered: far beyond any client's retries. */
export const IDEMPOTENCY_TTL_SECONDS = 30 * 24 * 60 * 60;

/** UUIDs and the like; long enough to be unguessable, short enough to index. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;

/**
 * The request's `Idempotency-Key`, or undefined when it sent none. A
 * malformed key is a 400 rather than silently ignored: a client that meant
 * to be safe to retry should learn that it is not.
 */
export function idempotencyKeyOf(request: FastifyRequest): string | undefined {
  const raw = request.headers['idempotency-key'];
  if (raw === undefined) return undefined;
  const key = Array.isArray(raw) ? raw[0] : raw;
  if (!KEY_PATTERN.test(key)) {
    throw new ValidationError('Idempotency-Key نامعتبره');
  }
  return key;
}

/** JSON with object keys sorted, so `{a, b}` and `{b, a}` hash alike. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Fingerprint of what a request asks for: its target and its body. */
export function requestHash(value: unknown): string {
  return sha256(canonical(value));
}
