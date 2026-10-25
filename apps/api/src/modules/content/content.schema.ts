import {
  adminArticleListQuerySchema,
  articleInputSchema,
  articleListQuerySchema,
  articleReactionSchema,
  articleStatusSchema,
  contentIndexQuerySchema,
  SLUG_PATTERN,
  z,
} from '@hamdastan/validation';

/**
 * Request validation for the Content module. The bodies and queries are the
 * schemas `apps/admin` and `apps/web` build them with; only the path
 * parameters are local.
 */

// A malformed id would otherwise reach a `uuid` column and fail as a 500.
const idParams = z.object({ id: z.uuid({ error: 'شناسه معتبر نیست' }) });
// Anything that is not a slug cannot be one, and is the same 404 as a slug nobody has.
const slugParams = z.object({ slug: z.string().regex(SLUG_PATTERN, { error: 'محتوا پیدا نشد' }) });

export const contentSchemas = {
  byId: { params: idParams },
  bySlug: { params: slugParams },
  list: { query: articleListQuerySchema },
  adminList: { query: adminArticleListQuerySchema },
  index: { query: contentIndexQuerySchema },
  write: { body: articleInputSchema },
  status: { body: articleStatusSchema },
  reaction: { body: articleReactionSchema },
} satisfies Record<string, unknown>;
