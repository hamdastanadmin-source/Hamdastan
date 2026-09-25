import { z } from '@hamdastan/validation';

import { ValidationError } from './errors';

/**
 * Parses a request body against a module's schema, or rejects the request.
 *
 * Fastify's own `schema` option takes JSON Schema and no zod type provider is
 * wired up, so every module validates in its controller — see
 * `docs/ARCHITECTURE.md`. This lives here so all twelve of them report a
 * malformed body with the same code, the same message and the same `details`
 * shape, rather than each inventing one.
 */
export function parseRequest<T extends z.ZodType>(
  schema: T,
  payload: unknown
): z.output<T> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ValidationError('ورودی نامعتبر است', z.treeifyError(result.error));
  }
  return result.data;
}
