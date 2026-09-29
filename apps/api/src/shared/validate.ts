import { z } from '@hamdastan/validation';

import { ValidationError } from './errors';

/**
 * Parses a request body with one of the shared schemas.
 *
 * Fastify's own `schema` option takes JSON Schema, which validates but does
 * not *transform* — and every schema in `@hamdastan/validation` normalises as
 * well as validates (`۰۹۱۲…` and `+98912…` become one phone number, Arabic
 * ي becomes Persian ی). Running them through zod here is what lets the API
 * and the browser share one definition of a field instead of two that drift.
 *
 * The failure is turned into the API's own `ValidationError`, so the shape of
 * a 400 is the same whoever raised it, and `details` carries the per-field
 * messages the form puts under each input.
 */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || '_';
    // First message per field: the form shows one line under one input.
    fieldErrors[field] ??= issue.message;
  }

  throw new ValidationError(
    Object.values(fieldErrors)[0] ?? 'ورودی نامعتبر است',
    { fields: fieldErrors }
  );
}
