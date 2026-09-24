import { z } from '@hamdastan/validation';

/**
 * Request validation for the Commerce module.
 *
 * Every route validates its input here before the controller runs. Rules the
 * front-end also enforces live in `@hamdastan/validation` — import them
 * rather than restating them, so the two sides cannot drift.
 */
export const commerceSchemas = {
  // e.g. list: { querystring: paginationQuerySchema },
} satisfies Record<string, unknown>;

export type CommerceSchemas = typeof commerceSchemas;

// Re-exported so this module's own schemas can be written without a second
// zod import.
export { z };
