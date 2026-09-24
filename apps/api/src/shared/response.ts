import type { ApiFailure, ApiSuccess, Paginated } from '@hamdastan/types';

/**
 * Every response leaves the API in one of these two shapes, so the client's
 * HTTP layer can unwrap it without knowing which endpoint it called.
 */

export function ok<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function fail(
  code: string,
  message: string,
  details?: unknown
): ApiFailure {
  return { ok: false, error: { code, message, details } };
}

export function paginated<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number
): ApiSuccess<Paginated<T>> {
  return ok({ items, page, pageSize, total });
}
