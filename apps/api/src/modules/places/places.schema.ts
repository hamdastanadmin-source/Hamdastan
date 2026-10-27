import {
  placeCreateSchema,
  placeInputSchema,
  placeStatusSchema,
  SLUG_PATTERN,
  z,
} from '@hamdastan/validation';

/**
 * Request validation for the Places module. The bodies are the schemas
 * `apps/admin` builds its requests from; only the path parameters are local.
 */

// A malformed id would otherwise reach a `uuid` column and fail as a 500.
const idParams = z.object({ id: z.uuid({ error: 'مکان پیدا نشد' }) });
const worldParams = z.object({ slug: z.string().regex(SLUG_PATTERN, { error: 'دنیا پیدا نشد' }) });

export const placesSchemas = {
  byId: { params: idParams },
  create: { body: placeCreateSchema },
  write: { body: placeInputSchema },
  status: { body: placeStatusSchema },
  world: { params: worldParams },
  place: { params: worldParams.extend({ id: idParams.shape.id }) },
} satisfies Record<string, unknown>;
