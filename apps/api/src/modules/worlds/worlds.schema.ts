import {
  reorderSchema,
  SLUG_PATTERN,
  worldHomeCandidatesQuerySchema,
  worldHomeInputSchema,
  worldInputSchema,
  worldStatusSchema,
  z,
} from '@hamdastan/validation';

/**
 * Request validation for the Worlds module. The bodies are the schemas
 * `apps/admin` parses with; only the path parameters are local.
 */

// A malformed id would otherwise reach a `uuid` column and fail as a 500.
const idParams = z.object({ id: z.uuid({ error: 'شناسه معتبر نیست' }) });
const slugParams = z.object({ slug: z.string().regex(SLUG_PATTERN, { error: 'دنیا پیدا نشد' }) });

export const worldsSchemas = {
  byId: { params: idParams },
  bySlug: { params: slugParams },
  write: { body: worldInputSchema },
  status: { body: worldStatusSchema },
  reorder: { body: reorderSchema },
  home: { body: worldHomeInputSchema },
  candidates: { query: worldHomeCandidatesQuerySchema },
} satisfies Record<string, unknown>;
