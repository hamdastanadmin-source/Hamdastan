
import {
  activityDraftSchema,
  activityInputSchema,
  activityListQuerySchema,
  activityResultsQuerySchema,
  activityStatusActionSchema,
  activitySubmitSchema,
  audiencePreviewSchema,
  paginationQuerySchema,
  reviewListQuerySchema,
  submissionReviewSchema,
  xpRevokeSchema,
  z,
} from '@hamdastan/validation';

/**
 * Request validation for the Engagement module. The bodies are the schemas
 * `apps/admin` and `apps/web` parse with; only the path parameters are local.
 */

// A malformed id would otherwise reach a `uuid` column and fail as a 500.
const idParams = z.object({ id: z.uuid({ error: 'شناسه معتبر نیست' }) });
const transactionParams = z.object({ id: z.string().regex(/^\d{1,18}$/, { error: 'شناسه معتبر نیست' }) });

export const engagementSchemas = {
  list: { query: activityListQuerySchema },
  byId: { params: idParams },
  write: { body: activityInputSchema },
  status: { body: activityStatusActionSchema },
  audience: { body: audiencePreviewSchema },
  results: { query: activityResultsQuerySchema },
  submissions: { query: reviewListQuerySchema },
  review: { body: submissionReviewSchema },
  grants: { query: paginationQuerySchema },
  revoke: { params: transactionParams, body: xpRevokeSchema },
  draft: { body: activityDraftSchema },
  submit: { body: activitySubmitSchema },
} satisfies Record<string, unknown>;
