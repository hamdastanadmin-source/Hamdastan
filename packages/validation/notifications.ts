/**
 * Notifications' rules, written once: the panel's campaign form and the
 * `notifications` module parse with the same schemas, and the product's
 * preferences and push subscription are checked here too.
 */

import {
  CAMPAIGN_CATEGORIES,
  INTEREST_CATEGORIES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_LIMITS as L,
  OPTIONAL_NOTIFICATION_CATEGORIES,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { z } from 'zod';

import { phoneSchema } from './auth';
import { line, paragraph } from './common';
import { mediaIdSchema } from './media';

const fa = (n: number) => toPersianDigits(n);

const uuid = z.uuid({ error: 'شناسه معتبر نیست' });

export const notificationDestinationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('home') }),
  z.object({ kind: z.literal('events') }),
  z.object({ kind: z.literal('my_events') }),
  z.object({ kind: z.literal('activities') }),
  z.object({ kind: z.literal('profile') }),
  z.object({ kind: z.literal('event'), eventId: z.uuid({ error: 'رویداد رو انتخاب کن' }) }),
  z.object({ kind: z.literal('activity'), activityId: z.uuid({ error: 'فعالیت رو انتخاب کن' }) }),
]);

export const notificationAudienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({
    kind: z.literal('users'),
    phones: z
      .array(phoneSchema)
      .min(1, { error: 'حداقل یک شماره وارد کن' })
      .max(L.AUDIENCE_PHONES_MAX, { error: `حداکثر ${fa(L.AUDIENCE_PHONES_MAX)} شماره` })
      .transform((phones) => [...new Set(phones)]),
  }),
  z.object({
    kind: z.literal('interests'),
    categoryIds: z
      .array(z.enum(INTEREST_CATEGORIES.map((category) => category.id) as [string, ...string[]]))
      .min(1, { error: 'حداقل یک گروه انتخاب کن' })
      .transform((ids) => [...new Set(ids)]),
  }),
  z.object({
    kind: z.literal('event'),
    eventId: z.uuid({ error: 'رویداد رو انتخاب کن' }),
    relation: z.enum(['interested', 'confirmed']),
  }),
  z.object({
    kind: z.literal('world'),
    worldIds: z
      .array(uuid)
      .min(1, { error: 'حداقل یک دنیا انتخاب کن' })
      .max(L.WORLDS_MAX, { error: `حداکثر ${fa(L.WORLDS_MAX)} دنیا` })
      .transform((ids) => [...new Set(ids)]),
  }),
]);

/** `POST /admin/notifications/campaigns` and `PUT …/:id`. A draft may be saved incomplete. */
export const campaignInputSchema = z.object({
  title: line(L.TITLE_MAX, null),
  body: paragraph(L.BODY_MAX),
  category: z.enum(CAMPAIGN_CATEGORIES),
  imageId: mediaIdSchema.nullable(),
  destination: notificationDestinationSchema,
  audience: notificationAudienceSchema,
  push: z.boolean(),
});

export type CampaignInputOutput = z.output<typeof campaignInputSchema>;

/** What a campaign needs before it may be sent or scheduled. Shared with the panel's checklist. */
export function campaignSendProblems(input: { title: string; body: string }): { field: string; message: string }[] {
  const problems: { field: string; message: string }[] = [];
  if (!input.title.trim()) problems.push({ field: 'title', message: 'عنوان اعلان رو بنویس' });
  if (!input.body.trim()) problems.push({ field: 'body', message: 'متن کوتاه اعلان رو بنویس' });
  return problems;
}

export const campaignSendSchema = z.object({
  scheduledAt: z.iso.datetime({ offset: true, error: 'زمان معتبر نیست' }).nullable(),
});

export const campaignListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed', 'archived']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type CampaignListQueryOutput = z.output<typeof campaignListQuerySchema>;

// ─── Product ─────────────────────────────────────────────────────────────────

export const notificationInboxQuerySchema = z.object({
  filter: z.enum(['all', 'unread', ...NOTIFICATION_CATEGORIES]).default('all'),
  /** The cursor the last page answered. */
  before: z.string().max(80).optional(),
});

export const notificationPreferencesSchema = z.object({
  categories: z
    .array(
      z.object({
        category: z.enum(OPTIONAL_NOTIFICATION_CATEGORIES as [string, ...string[]]),
        inApp: z.boolean(),
        push: z.boolean(),
      })
    )
    .max(OPTIONAL_NOTIFICATION_CATEGORIES.length),
});

/** A browser push subscription. The endpoint is the push service's own https address. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/, error: 'اشتراک اعلان معتبر نیست' }).max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().max(1000) });
