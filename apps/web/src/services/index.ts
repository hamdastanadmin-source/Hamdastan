/**
 * API access layer.
 *
 * One module per backend resource, each exposing plain async functions that
 * components and hooks can call. This is the only directory that knows a
 * route path.
 */

export { apiClient } from './api-client';
export { HttpError } from '@hamdastan/shared';
