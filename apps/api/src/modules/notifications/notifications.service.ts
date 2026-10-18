import { randomUUID } from 'node:crypto';

import {
  NOTIFICATION_DEFAULTS,
  NOTIFICATION_LIMITS as L,
  OPTIONAL_NOTIFICATION_CATEGORIES,
} from '@hamdastan/config';
import {
  ADMIN_ROLE_PERMISSIONS,
  ADMIN_ERROR_CODES,
  NOTIFICATION_ERROR_CODES as CODES,
  type AdminCampaign,
  type AdminCampaignSummary,
  type AudienceEstimate,
  type CampaignHistoryEntry,
  type CampaignOptions,
  type CampaignReport,
  type NotificationAudience,
  type NotificationDestination,
  type NotificationFilter,
  type NotificationInbox,
  type NotificationOpenResult,
  type NotificationPreferences,
  type NotificationsOverview,
  type Paginated,
  type PushSubscriptionInput,
} from '@hamdastan/types';
import { campaignSendProblems, type CampaignInputOutput, type CampaignListQueryOutput } from '@hamdastan/validation';

import type { PushSender } from '../../integrations';
import { sha256 } from '../../shared/crypto';
import { AppError, NotFoundError } from '../../shared/errors';
import type { AdminRecord } from '../admin';
import { mediaService } from '../media';
import { levelFor, progressService } from '../progress';
import type { UserRecord } from '../users';

import * as messages from './notifications.messages';
import { notificationsRepository as repo } from './notifications.repository';
import type {
  CampaignRecord,
  DeliveryResult,
  EventSummary,
  InboxCursor,
  InboxRow,
  NotificationContent,
  Recipients,
} from './notifications.types';

/**
 * Business logic for notifications — اعلان‌ها.
 *
 * One pipeline for both sources. A system notification (XP, a badge, an
 * event's news) and an admin's campaign both become rows through
 * `repository.deliver`, which applies the person's preferences and queues
 * the pushes; both are read from the same inbox and opened through `open`,
 * which re-checks the destination for this person at that moment.
 *
 * Producing a notification never fails the action that caused it: the XP
 * is already in the ledger, the event already cancelled. A failure is
 * logged and the action answers as usual (`safely`).
 *
 * Push is a second, independent step. The dispatcher (`dispatchOnce`,
 * timed by `maintenance`) sends what `deliver` queued; without a push
 * service bound, nothing is queued and nothing claims to have been pushed.
 */

type Log = { error(details: object, message: string): void; info(details: object, message: string): void };

let log: Log = { error: () => undefined, info: () => undefined };
let pushSender: PushSender | null = null;

/** Binds the logger producers report their failures to. Called once, at boot. */
export const setNotificationsLogger = (next: Log) => {
  log = next;
};

/** Binds the push service, or null when none is configured. Called once, at boot. */
export const setPushSender = (next: PushSender | null) => {
  pushSender = next;
};

async function safely(what: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    log.error({ err: error, notification: what }, 'notifications: could not create a notification');
  }
}

const deliver = (content: NotificationContent, recipients: Recipients) =>
  repo().deliver(content, recipients, pushSender !== null);

const iso = (date: Date | null) => date?.toISOString() ?? null;

const notFound = () => new NotFoundError('اعلان پیدا نشد');
const campaignNotFound = () => new NotFoundError('کمپین یافت نشد');

// ─── Inbox cursor ────────────────────────────────────────────────────────────

const encodeCursor = (row: { cursorAt: string; id: string }) =>
  Buffer.from(`${row.cursorAt}|${row.id}`).toString('base64url');

function decodeCursor(cursor: string | undefined): InboxCursor | null {
  if (!cursor) return null;
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (!at || !id || Number.isNaN(new Date(at).getTime()) || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return { createdAt: at, id };
}

const toItem = (row: InboxRow, now: Date) => ({
  id: row.id,
  category: row.category,
  type: row.type,
  title: row.title,
  body: row.body,
  imageId: row.imageId,
  actionable: row.destination.kind !== 'none',
  read: row.readAt !== null,
  expired: row.expiresAt !== null && row.expiresAt <= now,
  createdAt: row.createdAt.toISOString(),
});

// ─── Campaigns ───────────────────────────────────────────────────────────────

const toSummary = (record: CampaignRecord): AdminCampaignSummary => ({
  id: record.id,
  title: record.title,
  category: record.category,
  audience: record.audience,
  push: record.push,
  status: record.status,
  scheduledAt: iso(record.scheduledAt),
  sentAt: iso(record.sentAt),
  recipientCount: record.recipientCount,
  createdBy: record.createdBy,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const toCampaign = (record: CampaignRecord): AdminCampaign => ({
  ...toSummary(record),
  body: record.body,
  imageId: record.imageId,
  destination: record.destination,
  startedAt: iso(record.startedAt),
  error: record.error,
});

const invalidTransition = () =>
  new AppError(409, CODES.CAMPAIGN_INVALID_TRANSITION, 'این کار برای کمپین در این وضعیت ممکن نیست');

/** «Everyone» is its own permission, checked here as well as hidden in the panel. */
function assertMaySendTo(actor: AdminRecord, audience: NotificationAudience): void {
  if (audience.kind === 'all' && !ADMIN_ROLE_PERMISSIONS[actor.role].includes('notifications.broadcast')) {
    throw new AppError(403, ADMIN_ERROR_CODES.ADMIN_PERMISSION_DENIED, 'ارسال به همه‌ی کاربران برای نقش شما مجاز نیست');
  }
}

/** The campaign as every recipient receives it. One name per campaign, so a re-run sends nothing twice. */
const campaignContent = (campaign: CampaignRecord): NotificationContent => ({
  category: campaign.category,
  type: 'campaign',
  title: campaign.title,
  body: campaign.body,
  imageId: campaign.imageId,
  destination: campaign.destination,
  dedupeKey: `campaign:${campaign.id}`,
  expiresAt: null,
  campaignId: campaign.id,
  push: campaign.push,
});

// ─── Delivery ────────────────────────────────────────────────────────────────

/** After a failed attempt, wait this long before the next; past the last, give up. */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000];
/** A leased push not recorded by then (the process died) is tried again. */
const LEASE_MS = 5 * 60_000;
/** A campaign `sending` for this long was interrupted; it is taken again (idempotently). */
const STALE_SENDING_MS = 10 * 60_000;
const CAMPAIGNS_PER_PASS = 5;
const PUSH_CONCURRENCY = 20;
const REMINDER_HOURS = 24;

const RETENTION = { notificationDays: 180, deliveryDays: 30 };

async function sendPushes(limit: number, now: Date): Promise<{ sent: number; retried: number; failed: number }> {
  const sender = pushSender;
  const tally = { sent: 0, retried: 0, failed: 0 };
  if (!sender) return tally;

  const jobs = await repo().claimDueDeliveries(now, limit, new Date(now.getTime() + LEASE_MS));
  const results: DeliveryResult[] = [];

  for (let start = 0; start < jobs.length; start += PUSH_CONCURRENCY) {
    const batch = jobs.slice(start, start + PUSH_CONCURRENCY);
    results.push(
      ...(await Promise.all(
        batch.map(async (job): Promise<DeliveryResult> => {
          if (!job.subscriptionId) return { id: job.id, status: 'failed', error: 'اشتراک دستگاه دیگر وجود ندارد' };
          const outcome = await sender.send(
            { endpoint: job.endpoint, p256dh: job.p256dh, auth: job.auth },
            { title: job.title, body: job.body, url: `/notifications/${job.notificationId}`, tag: job.notificationId }
          );
          if (outcome.status === 'sent') return { id: job.id, status: 'sent' };
          if (outcome.status === 'gone') {
            return { id: job.id, status: 'failed', error: outcome.error, forgetSubscriptionId: job.subscriptionId };
          }
          const delay = RETRY_DELAYS_MS[job.attempts - 1];
          if (outcome.status === 'retry' && delay !== undefined) {
            return { id: job.id, status: 'retry', error: outcome.error, nextAttemptAt: new Date(Date.now() + delay) };
          }
          return { id: job.id, status: 'failed', error: outcome.error };
        })
      ))
    );
  }

  await repo().recordDeliveries(results);
  for (const result of results) {
    if (result.status === 'sent') tally.sent += 1;
    else if (result.status === 'retry') tally.retried += 1;
    else tally.failed += 1;
  }
  return tally;
}

async function sendCampaign(campaign: CampaignRecord): Promise<void> {
  // Re-checked at delivery, not only when scheduled: the event may have been
  // unpublished in between. Its audience is filtered again by `deliver`.
  if (!(await repo().destinationExists(campaign.destination))) {
    await repo().finishCampaign(campaign.id, { status: 'failed', error: 'مقصد اعلان دیگر در دسترس نیست' });
    return;
  }
  if (campaign.push && !pushSender) {
    await repo().audit(campaign.id, null, 'push_skipped').catch(() => undefined);
  }
  await deliver(campaignContent(campaign), { kind: 'audience', audience: campaign.audience });
  const { recipients } = await repo().report(campaign.id);
  await repo().finishCampaign(campaign.id, { status: 'sent', recipients });
}

export const notificationsService = {
  // ─── Producers: what the system sends on its own ───────────────────────

  /**
   * XP earned by the person's own action, and the level it took them to.
   * `dedupeKey` names the grant, so the same grant twice notifies once.
   */
  xpEarned(userId: string, input: { xp: number; reason: string; dedupeKey: string; destination: NotificationDestination }) {
    if (input.xp <= 0) return Promise.resolve();
    return safely('xp_earned', async () => {
      await deliver(messages.xpEarned(input), { kind: 'user', userId });
      await notificationsService.levelCheck(userId, input.xp);
    });
  },

  /** A level is announced once, the first time it is reached. */
  async levelCheck(userId: string, xpAdded: number): Promise<void> {
    const total = await progressService.total(userId);
    const { level } = levelFor(total);
    if (level > levelFor(Math.max(0, total - xpAdded)).level) {
      await deliver(messages.levelUp(level), { kind: 'user', userId });
    }
  },

  badgeEarned(userId: string, badge: { id: string; title: string }) {
    return safely('badge_earned', () => deliver(messages.badgeEarned(badge), { kind: 'user', userId }));
  },

  submissionReviewed(
    userId: string,
    input: { responseId: string; activityId: string; activityTitle: string; approved: boolean; xp: number }
  ) {
    return safely('submission_reviewed', async () => {
      await deliver(messages.submissionReviewed(input), { kind: 'user', userId });
      if (input.xp > 0) await notificationsService.levelCheck(userId, input.xp);
    });
  },

  eventCancelled(eventId: string) {
    return safely('event_cancelled', async () => {
      const event = await repo().findEvent(eventId);
      if (event) await deliver(messages.eventCancelled(event), { kind: 'event_followers', eventId });
    });
  },

  /** Only what a person planned around: the start, the end, the place. */
  eventChanged(before: EventSummary & { venue: string }, after: EventSummary & { venue: string }) {
    const time = iso(before.startAt) !== iso(after.startAt) || iso(before.endAt) !== iso(after.endAt);
    const venue = before.venue !== after.venue;
    if (!time && !venue) return Promise.resolve();
    const signature = sha256(`${iso(after.startAt)}|${iso(after.endAt)}|${after.venue}`).slice(0, 32);
    return safely('event_changed', () =>
      deliver(messages.eventChanged(after, { time, venue, signature }), { kind: 'event_followers', eventId: after.id })
    );
  },

  bookingReviewed(bookingId: string, status: 'confirmed' | 'failed' | 'cancelled') {
    return safely('booking_reviewed', async () => {
      const event = await repo().findBookingEvent(bookingId);
      if (event) await deliver(messages.bookingReviewed(event, bookingId, status), { kind: 'booking', bookingId });
    });
  },

  // ─── The dispatcher ────────────────────────────────────────────────────

  /**
   * One pass: due campaigns, the next day's event reminders, then a batch
   * of queued pushes. Safe to run on several instances at once — every
   * claim is `FOR UPDATE SKIP LOCKED` and every insert has its dedupe key.
   */
  async dispatchOnce(now = new Date(), pushBatch = 500) {
    let campaigns = 0;
    for (; campaigns < CAMPAIGNS_PER_PASS; campaigns += 1) {
      const campaign = await repo().claimDueCampaign(now, new Date(now.getTime() - STALE_SENDING_MS));
      if (!campaign) break;
      try {
        await sendCampaign(campaign);
      } catch (error) {
        log.error({ err: error, campaignId: campaign.id }, 'notifications: campaign failed');
        await repo().finishCampaign(campaign.id, { status: 'failed', error: 'ارسال با خطا متوقف شد' });
      }
    }

    let reminders = 0;
    for (const event of await repo().dueReminderEvents(now, REMINDER_HOURS)) {
      reminders += (await deliver(messages.eventReminder(event), { kind: 'event_reminder', eventId: event.id })).created;
    }

    // Read the clock again: what this pass just queued is due now, not at the pass's start.
    const push = await sendPushes(pushBatch, new Date(Math.max(now.getTime(), Date.now())));
    return { campaigns, reminders, push };
  },

  /** Old notifications and finished push records, for the cleanup job. */
  purge(now: Date) {
    return repo().purge(now, RETENTION);
  },

  // ─── Product ───────────────────────────────────────────────────────────

  async inbox(user: UserRecord, filter: NotificationFilter, before?: string): Promise<NotificationInbox> {
    const now = new Date();
    const rows = await repo().inbox(user.id, filter, decodeCursor(before), L.PAGE_SIZE + 1);
    const page = rows.slice(0, L.PAGE_SIZE);
    return {
      items: page.map((row) => toItem(row, now)),
      nextCursor: rows.length > L.PAGE_SIZE ? encodeCursor(page.at(-1)!) : null,
      unread: await repo().unreadCount(user.id),
    };
  },

  async unread(user: UserRecord): Promise<{ unread: number }> {
    return { unread: await repo().unreadCount(user.id) };
  },

  async markRead(user: UserRecord, ids: string[] | 'all'): Promise<{ unread: number }> {
    await repo().markRead(user.id, ids);
    return this.unread(user);
  },

  /**
   * Opening is where access is decided again: an event the person may no
   * longer see, an expired notification or one that leads nowhere answers
   * `href: null`, and the product stays on the Notification Center.
   */
  async open(user: UserRecord, id: string): Promise<NotificationOpenResult> {
    const found = await repo().open(user.id, id);
    if (!found) throw notFound();
    if (found.expiresAt && found.expiresAt <= new Date()) return { href: null };
    const { destination } = found;
    if (destination.kind === 'event') {
      const slug = await repo().visibleEventSlug(destination.eventId, user.id);
      return { href: slug ? `/events/${slug}` : null };
    }
    // The activity's page decides access itself, and answers 404 to someone outside its audience.
    if (destination.kind === 'activity') return { href: `/activities/${destination.activityId}` };
    return { href: messages.STATIC_PATHS[destination.kind] ?? null };
  },

  async dismiss(user: UserRecord, id: string): Promise<{ unread: number }> {
    if (!(await repo().dismiss(user.id, id))) throw notFound();
    return this.unread(user);
  },

  async preferences(user: UserRecord): Promise<NotificationPreferences> {
    const stored = new Map((await repo().preferences(user.id)).map((row) => [row.category, row]));
    return {
      categories: OPTIONAL_NOTIFICATION_CATEGORIES.map((category) => ({
        category,
        inApp: stored.get(category)?.inApp ?? NOTIFICATION_DEFAULTS.inApp,
        push: stored.get(category)?.push ?? NOTIFICATION_DEFAULTS.push(category),
      })),
      push: { available: pushSender !== null, publicKey: pushSender?.publicKey ?? null },
    };
  },

  async savePreferences(
    user: UserRecord,
    categories: { category: string; inApp: boolean; push: boolean }[]
  ): Promise<NotificationPreferences> {
    await repo().savePreferences(user.id, categories);
    return this.preferences(user);
  },

  async subscribe(user: UserRecord, input: PushSubscriptionInput, userAgent: string): Promise<{ subscribed: true }> {
    if (!pushSender) throw new AppError(503, CODES.PUSH_UNAVAILABLE, 'اعلان گوشی فعلاً در دسترس نیست');
    await repo().saveSubscription(user.id, { endpoint: input.endpoint, ...input.keys }, userAgent);
    return { subscribed: true };
  },

  async unsubscribe(user: UserRecord, endpoint: string): Promise<{ subscribed: false }> {
    await repo().removeSubscription(user.id, endpoint);
    return { subscribed: false };
  },

  // ─── Admin ─────────────────────────────────────────────────────────────

  async overview(): Promise<NotificationsOverview> {
    const counts = await repo().overview();
    return { ...counts, push: { available: pushSender !== null, ...counts.push } };
  },

  async listCampaigns(query: CampaignListQueryOutput): Promise<Paginated<AdminCampaignSummary>> {
    const pageSize = L.ADMIN_PAGE_SIZE;
    const { items, total } = await repo().listCampaigns({ ...query, search: query.search || undefined, pageSize });
    return { items: items.map(toSummary), page: query.page, pageSize, total };
  },

  async getCampaign(id: string): Promise<AdminCampaign> {
    const found = await repo().findCampaign(id);
    if (!found) throw campaignNotFound();
    return toCampaign(found);
  },

  async createCampaign(actor: AdminRecord, input: CampaignInputOutput): Promise<AdminCampaign> {
    await mediaService.requireImages({ imageId: input.imageId });
    return this.getCampaign(await repo().createCampaign(input, actor.id));
  },

  /** Only a draft is edited; what was sent or scheduled is what it was. */
  async updateCampaign(actor: AdminRecord, id: string, input: CampaignInputOutput): Promise<AdminCampaign> {
    await mediaService.requireImages({ imageId: input.imageId });
    if (!(await repo().updateDraft(id, input, actor.id))) {
      if (!(await repo().findCampaign(id))) throw campaignNotFound();
      throw new AppError(409, CODES.CAMPAIGN_NOT_EDITABLE, 'فقط پیش‌نویس قابل ویرایش است؛ از آن یک نسخه‌ی تازه بسازید');
    }
    return this.getCampaign(id);
  },

  async duplicate(actor: AdminRecord, id: string): Promise<AdminCampaign> {
    const source = await this.getCampaign(id);
    const copy = await repo().createCampaign(
      {
        title: source.title,
        body: source.body,
        category: source.category,
        imageId: source.imageId,
        destination: source.destination,
        audience: source.audience,
        push: source.push,
      },
      actor.id
    );
    await repo().audit(copy, actor.id, 'duplicated_from', { campaignId: id });
    return this.getCampaign(copy);
  },

  /**
   * Send now or at a time — either way the dispatcher sends it, never this
   * request: «now» is a schedule for the present moment. From a draft, from
   * a failed attempt, or a scheduled one being re-timed.
   */
  async send(actor: AdminRecord, id: string, scheduledAt: string | null): Promise<AdminCampaign> {
    const campaign = await this.getCampaign(id);
    const problems = campaignSendProblems(campaign);
    if (problems.length) {
      throw new AppError(400, 'VALIDATION_ERROR', problems[0].message, {
        fields: Object.fromEntries(problems.map((p) => [p.field, p.message])),
      });
    }
    assertMaySendTo(actor, campaign.audience);
    if (campaign.push && !pushSender) {
      throw new AppError(400, CODES.PUSH_UNAVAILABLE, 'زیرساخت اعلان گوشی پیکربندی نشده است؛ کانال «فقط درون برنامه» را انتخاب کنید');
    }
    if (!(await repo().destinationExists(campaign.destination))) {
      throw new AppError(400, CODES.DESTINATION_UNAVAILABLE, 'مقصد انتخاب‌شده منتشر نشده یا دیگر وجود ندارد');
    }

    const now = new Date();
    const when = scheduledAt && new Date(scheduledAt) > now ? new Date(scheduledAt) : now;
    const moved = await repo().transition(
      id,
      {
        to: 'scheduled',
        from: ['draft', 'failed', 'scheduled'],
        scheduledAt: when,
        action: when > now ? 'schedule' : 'send',
        details: { scheduledAt: when.toISOString() },
      },
      actor.id
    );
    if (!moved) throw invalidTransition();
    return this.getCampaign(id);
  },

  /** A scheduled campaign is stopped before anything is created. */
  async cancel(actor: AdminRecord, id: string): Promise<AdminCampaign> {
    if (!(await repo().transition(id, { to: 'cancelled', from: ['scheduled'], action: 'cancel' }, actor.id))) {
      throw invalidTransition();
    }
    return this.getCampaign(id);
  },

  /** A sent campaign's in-app notifications stay; the pushes not yet sent are not sent. */
  async stopPush(actor: AdminRecord, id: string): Promise<{ cancelled: number }> {
    const campaign = await this.getCampaign(id);
    if (campaign.status !== 'sent' && campaign.status !== 'sending') throw invalidTransition();
    return { cancelled: await repo().cancelQueuedPushes(id, actor.id) };
  },

  async archive(actor: AdminRecord, id: string): Promise<AdminCampaign> {
    const moved = await repo().transition(
      id,
      { to: 'archived', from: ['draft', 'sent', 'cancelled', 'failed'], action: 'archive' },
      actor.id
    );
    if (!moved) throw invalidTransition();
    return this.getCampaign(id);
  },

  async report(id: string): Promise<CampaignReport> {
    await this.getCampaign(id);
    return repo().report(id);
  },

  async history(id: string): Promise<CampaignHistoryEntry[]> {
    await this.getCampaign(id);
    return repo().history(id);
  },

  estimate(audience: NotificationAudience, category: string, destination: NotificationDestination): Promise<AudienceEstimate> {
    return repo().estimate(audience, category, destination);
  },

  async options(): Promise<CampaignOptions> {
    return { ...(await repo().options()), pushAvailable: pushSender !== null };
  },
};

/** A fresh name for a notification whose cause has no stable id of its own. */
export const uniqueKey = (prefix: string, key?: string) => `${prefix}:${key ?? randomUUID()}`;
