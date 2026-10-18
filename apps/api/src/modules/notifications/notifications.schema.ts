import { CAMPAIGN_CATEGORIES } from '@hamdastan/config';
import {
  campaignInputSchema,
  campaignListQuerySchema,
  campaignSendSchema,
  notificationAudienceSchema,
  notificationDestinationSchema,
  notificationInboxQuerySchema,
  notificationPreferencesSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  z,
} from '@hamdastan/validation';

/**
 * Request validation for the Notifications module. The bodies are the
 * shared schemas `apps/web` and `apps/admin` parse with; only the path
 * parameters and two small bodies are local.
 */

// A malformed id would otherwise reach a `uuid` column and fail as a 500.
const idParams = z.object({ id: z.uuid({ error: 'شناسه معتبر نیست' }) });

export const notificationsSchemas = {
  byId: { params: idParams },
  inbox: { query: notificationInboxQuerySchema },
  read: { body: z.object({ ids: z.array(z.uuid()).max(100).optional() }) },
  preferences: { body: notificationPreferencesSchema },
  subscribe: { body: pushSubscriptionSchema },
  unsubscribe: { body: pushUnsubscribeSchema },

  campaigns: { query: campaignListQuerySchema },
  campaign: { body: campaignInputSchema },
  send: { body: campaignSendSchema },
  estimate: {
    body: z.object({
      audience: notificationAudienceSchema,
      category: z.enum(CAMPAIGN_CATEGORIES),
      destination: notificationDestinationSchema,
    }),
  },
} satisfies Record<string, unknown>;
