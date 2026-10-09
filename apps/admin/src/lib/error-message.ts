import { HttpError } from '@/services';

/**
 * The line to show when a call fails. The API already answers in Persian, so
 * this only covers the request never arriving.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  return 'ارتباط با سرور برقرار نشد. اتصال اینترنت رو بررسی کن.';
}

/** The API's stable error `code`, for a screen that reacts to one in particular. */
export function errorCode(error: unknown): string | null {
  return error instanceof HttpError ? error.code : null;
}

/** Per-field messages from a 400 `VALIDATION_ERROR`, keyed by field name. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof HttpError)) return {};
  const details = error.details as { fields?: Record<string, string> } | undefined;
  return details?.fields ?? {};
}
