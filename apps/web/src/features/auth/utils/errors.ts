import { HttpError } from '@/services';

/**
 * The line to put in front of the user when a call fails.
 *
 * The API already answers in Persian — its `message` is written for the
 * person, not for the log — so the job here is only to cover the case it
 * cannot: the request never arriving. Rewriting the server's wording would
 * mean maintaining the same sentence twice.
 */
export function authErrorMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  return 'ارتباط با سرور برقرار نشد. اینترنتت رو بررسی کن.';
}

/** `retryAfter` from a 429, in seconds, when the API sent one. */
export function retryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof HttpError)) return null;
  const details = error.details as { retryAfter?: unknown } | undefined;
  return typeof details?.retryAfter === 'number' ? details.retryAfter : null;
}
