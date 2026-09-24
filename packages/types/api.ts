/**
 * The wire contract between the front-end apps and `apps/api`.
 *
 * Both sides import these, so a change here is a change both sides see at
 * compile time. Every backend response is one of these two shapes.
 */

export type ApiErrorBody = {
  /** Stable, machine-readable. The UI switches on this, not on `message`. */
  code: string;
  /** Human-readable, already in Persian where it is shown to a user. */
  message: string;
  details?: unknown;
};

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: ApiErrorBody };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Cursor-free, page-based listing. Shared by every `GET /…` collection. */
export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type PaginationQuery = {
  page?: number;
  pageSize?: number;
};

export type SortDirection = 'asc' | 'desc';
