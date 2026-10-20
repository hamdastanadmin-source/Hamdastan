import { NOTIFICATION_DEFAULTS } from '@hamdastan/config';
import type {
  CampaignHistoryEntry,
  CampaignOptions,
  CampaignReport,
  CampaignStatus,
  NotificationAudience,
  NotificationDestination,
  NotificationFilter,
  NotificationsOverview,
} from '@hamdastan/types';

import { audienceMatch, deleteInBatches, query, queryOne, withTransaction } from '../../data';
import { createRepositorySlot } from '../../shared/repository';

import type {
  CampaignFields,
  CampaignFilter,
  CampaignRecord,
  CampaignTransition,
  DeliverOutcome,
  DeliveryJob,
  DeliveryResult,
  DueEvent,
  EventSummary,
  InboxCursor,
  InboxRow,
  NotificationContent,
  PreferenceRow,
  Recipients,
} from './notifications.types';

/**
 * Data access port for the Notifications module, and the PostgreSQL adapter
 * that satisfies it.
 *
 * Every notification is created by one statement, `deliver`: it picks the
 * recipients, drops whoever switched the category off, inserts one row each
 * — the unique (user_id, dedupe_key) makes a repeat insert nothing — and
 * queues a push for every subscribed device whose owner left push on. So a
 * campaign to fifty thousand people is one statement on the dispatcher's
 * connection, never fifty thousand round trips, and never an HTTP request.
 *
 * Who may be sent what is decided in SQL here, beside the audience: an
 * event's followers, a restricted event's audience (`audienceMatch`, the
 * same rule as events and Engagement Studio), a destination the person
 * could not open. The event and activity tables are read, never written.
 */
export interface NotificationsRepository {
  // ─── Creating ──────────────────────────────────────────────────────────
  deliver(content: NotificationContent, recipients: Recipients, pushAvailable: boolean): Promise<DeliverOutcome>;
  /** Published events starting within `hours`, for their reminders. */
  dueReminderEvents(now: Date, hours: number): Promise<DueEvent[]>;
  findEvent(eventId: string): Promise<EventSummary | null>;
  findBookingEvent(bookingId: string): Promise<EventSummary | null>;

  // ─── The inbox ─────────────────────────────────────────────────────────
  inbox(userId: string, filter: NotificationFilter, before: InboxCursor | null, limit: number): Promise<(InboxRow & { cursorAt: string })[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(userId: string, ids: string[] | 'all'): Promise<number>;
  /** Marks it read and opened; answers what it leads to, or null when it is not this person's. */
  open(userId: string, id: string): Promise<{ destination: NotificationDestination; expiresAt: Date | null } | null>;
  dismiss(userId: string, id: string): Promise<boolean>;
  /** The event's slug when this person may see it now, else null. */
  visibleEventSlug(eventId: string, userId: string): Promise<string | null>;

  // ─── Preferences and devices ───────────────────────────────────────────
  preferences(userId: string): Promise<PreferenceRow[]>;
  savePreferences(userId: string, rows: PreferenceRow[]): Promise<void>;
  saveSubscription(userId: string, subscription: { endpoint: string; p256dh: string; auth: string }, userAgent: string): Promise<void>;
  removeSubscription(userId: string, endpoint: string): Promise<void>;
  hasSubscription(userId: string): Promise<boolean>;

  // ─── The dispatcher ────────────────────────────────────────────────────
  /** Takes the next due campaign (or one stuck in `sending` since `staleBefore`) and marks it sending. */
  claimDueCampaign(now: Date, staleBefore: Date): Promise<CampaignRecord | null>;
  finishCampaign(id: string, outcome: { status: 'sent'; recipients: number } | { status: 'failed'; error: string }): Promise<void>;
  /** Leases a batch of queued pushes until `leaseUntil`, counting the attempt. */
  claimDueDeliveries(now: Date, limit: number, leaseUntil: Date): Promise<(DeliveryJob | { id: string; subscriptionId: null })[]>;
  recordDeliveries(results: DeliveryResult[]): Promise<void>;
  purge(now: Date, retention: { notificationDays: number; deliveryDays: number }): Promise<Record<string, number>>;

  // ─── Campaigns ─────────────────────────────────────────────────────────
  listCampaigns(filter: CampaignFilter): Promise<{ items: CampaignRecord[]; total: number }>;
  findCampaign(id: string): Promise<CampaignRecord | null>;
  createCampaign(fields: CampaignFields, adminId: string): Promise<string>;
  /** Only a draft; false otherwise. */
  updateDraft(id: string, fields: CampaignFields, adminId: string): Promise<boolean>;
  transition(id: string, move: CampaignTransition, adminId: string): Promise<boolean>;
  /** Cancels the pushes still queued for a campaign; answers how many. */
  cancelQueuedPushes(id: string, adminId: string): Promise<number>;
  audit(id: string, adminId: string | null, action: string, details?: Record<string, unknown>): Promise<void>;
  report(id: string): Promise<CampaignReport>;
  history(id: string): Promise<CampaignHistoryEntry[]>;
  overview(): Promise<Omit<NotificationsOverview, 'push'> & { push: { sent: number; failed: number } }>;
  estimate(audience: NotificationAudience, category: string, destination: NotificationDestination): Promise<{ eligible: number; push: number }>;
  /** Whether a campaign may point at this destination at all. */
  destinationExists(destination: NotificationDestination): Promise<boolean>;
  options(): Promise<Omit<CampaignOptions, 'pushAvailable'>>;
}

const slot = createRepositorySlot<NotificationsRepository>('notifications');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const notificationsRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setNotificationsRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

/** Collects bound parameters, answering each one's placeholder. */
function params() {
  const values: unknown[] = [];
  const add = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  return { values, add };
}

/** Interested, or confirmed, for the event named by `event` (an SQL uuid expression). */
const interested = (event: string) =>
  `EXISTS (SELECT 1 FROM v2_event_interests i WHERE i.user_id = u.id AND i.event_id = ${event})`;
const confirmed = (event: string) =>
  `EXISTS (SELECT 1 FROM v2_event_bookings b WHERE b.user_id = u.id AND b.event_id = ${event} AND b.status = 'confirmed')`;

/**
 * May the person `u` see the event `e` now — the rule of `visible` in
 * `events.repository.ts`: published or cancelled, its time come, and for a
 * restricted event, in its audience.
 */
const EVENT_VISIBLE = `e.status IN ('published', 'cancelled') AND e.publish_at <= now()
  AND (e.visibility <> 'restricted' OR ${audienceMatch('e.audience')})`;

/** The people a `Recipients` names, as a condition on `u`. */
function recipientClause(recipients: Recipients, add: (value: unknown) => string): string {
  switch (recipients.kind) {
    case 'user':
      return `u.id = ${add(recipients.userId)}::uuid`;
    case 'booking':
      return `u.id = (SELECT b.user_id FROM v2_event_bookings b WHERE b.id = ${add(recipients.bookingId)}::uuid)`;
    case 'event_followers': {
      const event = `${add(recipients.eventId)}::uuid`;
      return `(${interested(event)} OR EXISTS (SELECT 1 FROM v2_event_bookings b
        WHERE b.user_id = u.id AND b.event_id = ${event} AND b.status IN ('pending', 'confirmed')))`;
    }
    case 'event_reminder': {
      const event = `${add(recipients.eventId)}::uuid`;
      return `(EXISTS (SELECT 1 FROM v2_event_interests i WHERE i.user_id = u.id AND i.event_id = ${event} AND i.remind_in_app)
        OR ${confirmed(event)})`;
    }
    case 'audience':
      return audienceClause(recipients.audience, add);
  }
}

function audienceClause(audience: NotificationAudience, add: (value: unknown) => string): string {
  switch (audience.kind) {
    case 'all':
    case 'users':
    case 'interests':
      return audienceMatch(`${add(JSON.stringify(audience))}::jsonb`);
    case 'event': {
      const event = `${add(audience.eventId)}::uuid`;
      return audience.relation === 'interested' ? interested(event) : confirmed(event);
    }
    case 'world':
      return `EXISTS (SELECT 1 FROM v2_event_world_links l
        WHERE l.world_id = ANY(${add(audience.worldIds)}::uuid[])
          AND (${interested('l.event_id')} OR ${confirmed('l.event_id')}))`;
  }
}

/** Someone a campaign may lead to its destination: they could open it. */
function destinationClause(destination: NotificationDestination, add: (value: unknown) => string): string {
  if (destination.kind === 'event') {
    return `EXISTS (SELECT 1 FROM v2_events e WHERE e.id = ${add(destination.eventId)}::uuid AND ${EVENT_VISIBLE})`;
  }
  if (destination.kind === 'activity') {
    return `EXISTS (SELECT 1 FROM v2_engagement_activities a
      WHERE a.id = ${add(destination.activityId)}::uuid AND a.status = 'published' AND ${audienceMatch('a.audience')})`;
  }
  return 'true';
}

/**
 * Active people the recipients name who receive this category, with whether
 * their phones should get it. `system` cannot be switched off.
 */
function eligibleRecipients(
  recipients: Recipients,
  category: string,
  destination: NotificationDestination | null,
  add: (value: unknown) => string
) {
  const cat = add(category);
  return `SELECT u.id AS user_id, coalesce(p.push, ${add(NOTIFICATION_DEFAULTS.push(category as never))}::boolean) AS push
      FROM v2_users u
      LEFT JOIN v2_notification_preferences p ON p.user_id = u.id AND p.category = ${cat}
     WHERE u.status = 'ACTIVE'
       AND (${cat} = 'system' OR coalesce(p.in_app, ${add(NOTIFICATION_DEFAULTS.inApp)}::boolean))
       AND ${recipientClause(recipients, add)}
       AND ${destination ? destinationClause(destination, add) : 'true'}`;
}

type InboxDbRow = {
  id: string;
  category: InboxRow['category'];
  type: string;
  title: string;
  body: string;
  image_media_id: string | null;
  destination: NotificationDestination;
  expires_at: Date | null;
  created_at: Date;
  cursor_at: string;
  read_at: Date | null;
};

type CampaignRow = {
  id: string;
  title: string;
  body: string;
  category: CampaignFields['category'];
  image_media_id: string | null;
  destination: NotificationDestination;
  audience: NotificationAudience;
  push: boolean;
  status: CampaignStatus;
  scheduled_at: Date | null;
  started_at: Date | null;
  sent_at: Date | null;
  recipient_count: number | null;
  error: string;
  created_by_name: string | null;
  created_at: Date;
  updated_at: Date;
};

const CAMPAIGN_COLUMNS = `c.id, c.title, c.body, c.category, c.image_media_id, c.destination, c.audience, c.push,
  c.status, c.scheduled_at, c.started_at, c.sent_at, c.recipient_count, c.error, c.created_at, c.updated_at,
  (SELECT nullif(trim(a.first_name || ' ' || a.last_name), '') FROM v2_admin_users a WHERE a.id = c.created_by) AS created_by_name`;

const toCampaign = (row: CampaignRow): CampaignRecord => ({
  id: row.id,
  title: row.title,
  body: row.body,
  category: row.category,
  imageId: row.image_media_id,
  destination: row.destination,
  audience: row.audience,
  push: row.push,
  status: row.status,
  scheduledAt: row.scheduled_at,
  startedAt: row.started_at,
  sentAt: row.sent_at,
  recipientCount: row.recipient_count,
  error: row.error,
  createdBy: row.created_by_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const audit = (campaignId: string, adminId: string | null, action: string, details: Record<string, unknown> = {}) =>
  query(`INSERT INTO v2_notification_audit_log (campaign_id, admin_id, action, details) VALUES ($1, $2, $3, $4)`, [
    campaignId,
    adminId,
    action,
    details,
  ]);

const STATUSES: CampaignStatus[] = ['draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed', 'archived'];

export const sqlNotificationsRepository: NotificationsRepository = {
  // ─── Creating ──────────────────────────────────────────────────────────
  async deliver(content, recipients, pushAvailable) {
    const { values, add } = params();
    // A campaign's destination narrows who may receive it; a system
    // notification is about something the person already holds.
    const destination = recipients.kind === 'audience' ? content.destination : null;
    const eligible = eligibleRecipients(recipients, content.category, destination, add);
    const row = await queryOne<{ created: number; queued: number }>(
      `WITH eligible AS (${eligible}),
       created AS (
         INSERT INTO v2_notifications
                (user_id, category, type, title, body, image_media_id, destination, campaign_id, dedupe_key, expires_at)
         SELECT e.user_id, ${add(content.category)}, ${add(content.type)}, ${add(content.title)}, ${add(content.body)},
                ${add(content.imageId)}::uuid, ${add(JSON.stringify(content.destination))}::jsonb,
                ${add(content.campaignId)}::uuid, ${add(content.dedupeKey)}, ${add(content.expiresAt)}::timestamptz
           FROM eligible e
         ON CONFLICT ON CONSTRAINT v2_notifications_once DO NOTHING
         RETURNING id, user_id, campaign_id),
       queued AS (
         INSERT INTO v2_notification_deliveries (notification_id, subscription_id, campaign_id)
         SELECT c.id, s.id, c.campaign_id
           FROM created c
           JOIN eligible e ON e.user_id = c.user_id AND e.push
           JOIN v2_push_subscriptions s ON s.user_id = c.user_id
          WHERE ${add(content.push && pushAvailable)}::boolean
         RETURNING 1)
       SELECT (SELECT count(*) FROM created)::int AS created, (SELECT count(*) FROM queued)::int AS queued`,
      values
    );
    return { created: row?.created ?? 0, queued: row?.queued ?? 0 };
  },

  async dueReminderEvents(now, hours) {
    const rows = await query<{ id: string; title: string; start_at: Date; end_at: Date | null }>(
      `SELECT e.id, e.title, e.start_at, e.end_at FROM v2_events e
        WHERE e.status = 'published' AND e.publish_at <= $1
          AND e.start_at > $1 AND e.start_at <= $1::timestamptz + make_interval(hours => $2)`,
      [now, hours]
    );
    return rows.map((row) => ({ id: row.id, title: row.title, startAt: row.start_at, endAt: row.end_at }));
  },

  async findEvent(eventId) {
    const row = await queryOne<{ id: string; title: string; start_at: Date | null; end_at: Date | null }>(
      `SELECT id, title, start_at, end_at FROM v2_events WHERE id = $1`,
      [eventId]
    );
    return row ? { id: row.id, title: row.title, startAt: row.start_at, endAt: row.end_at } : null;
  },

  async findBookingEvent(bookingId) {
    const row = await queryOne<{ id: string; title: string; start_at: Date | null; end_at: Date | null }>(
      `SELECT e.id, e.title, e.start_at, e.end_at FROM v2_event_bookings b JOIN v2_events e ON e.id = b.event_id WHERE b.id = $1`,
      [bookingId]
    );
    return row ? { id: row.id, title: row.title, startAt: row.start_at, endAt: row.end_at } : null;
  },

  // ─── The inbox ─────────────────────────────────────────────────────────
  async inbox(userId, filter, before, limit) {
    const rows = await query<InboxDbRow>(
      `SELECT n.id, n.category, n.type, n.title, n.body, n.image_media_id, n.destination, n.expires_at,
              n.created_at, n.created_at::text AS cursor_at, n.read_at
         FROM v2_notifications n
        WHERE n.user_id = $1 AND n.dismissed_at IS NULL
          AND ($2 = 'all' OR ($2 = 'unread' AND n.read_at IS NULL) OR n.category = $2)
          AND ($3::timestamptz IS NULL OR (n.created_at, n.id) < ($3::timestamptz, $4::uuid))
     ORDER BY n.created_at DESC, n.id DESC
        LIMIT $5`,
      [userId, filter, before?.createdAt ?? null, before?.id ?? null, limit]
    );
    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      type: row.type,
      title: row.title,
      body: row.body,
      imageId: row.image_media_id,
      destination: row.destination,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      readAt: row.read_at,
      cursorAt: row.cursor_at,
    }));
  },

  async unreadCount(userId) {
    const row = await queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM v2_notifications WHERE user_id = $1 AND read_at IS NULL AND dismissed_at IS NULL`,
      [userId]
    );
    return row?.count ?? 0;
  },

  async markRead(userId, ids) {
    const rows = await query(
      `UPDATE v2_notifications SET read_at = now()
        WHERE user_id = $1 AND read_at IS NULL AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))
        RETURNING id`,
      [userId, ids === 'all' ? null : ids]
    );
    return rows.length;
  },

  async open(userId, id) {
    const row = await queryOne<{ destination: NotificationDestination; expires_at: Date | null }>(
      `UPDATE v2_notifications SET read_at = coalesce(read_at, now()), opened_at = coalesce(opened_at, now())
        WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL
        RETURNING destination, expires_at`,
      [id, userId]
    );
    return row ? { destination: row.destination, expiresAt: row.expires_at } : null;
  },

  async dismiss(userId, id) {
    const rows = await query(
      `UPDATE v2_notifications SET dismissed_at = now(), read_at = coalesce(read_at, now())
        WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL RETURNING id`,
      [id, userId]
    );
    return rows.length > 0;
  },

  async visibleEventSlug(eventId, userId) {
    const row = await queryOne<{ slug: string }>(
      `SELECT e.slug FROM v2_events e, v2_users u
        WHERE e.id = $1 AND u.id = $2 AND u.status = 'ACTIVE' AND ${EVENT_VISIBLE}`,
      [eventId, userId]
    );
    return row?.slug ?? null;
  },

  // ─── Preferences and devices ───────────────────────────────────────────
  async preferences(userId) {
    const rows = await query<{ category: string; in_app: boolean; push: boolean }>(
      `SELECT category, in_app, push FROM v2_notification_preferences WHERE user_id = $1`,
      [userId]
    );
    return rows.map((row) => ({ category: row.category, inApp: row.in_app, push: row.push }));
  },

  async savePreferences(userId, rows) {
    if (rows.length === 0) return;
    await query(
      `INSERT INTO v2_notification_preferences (user_id, category, in_app, push)
       SELECT $1, p.category, p.in_app, p.push
         FROM unnest($2::text[], $3::boolean[], $4::boolean[]) AS p (category, in_app, push)
       ON CONFLICT (user_id, category) DO UPDATE
         SET in_app = EXCLUDED.in_app, push = EXCLUDED.push, updated_at = now()`,
      [userId, rows.map((r) => r.category), rows.map((r) => r.inApp), rows.map((r) => r.push)]
    );
  },

  async saveSubscription(userId, subscription, userAgent) {
    // An endpoint belongs to one browser; whoever is signed in on it now owns it.
    await query(
      `INSERT INTO v2_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ON CONSTRAINT v2_push_subscriptions_endpoint DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
             user_agent = EXCLUDED.user_agent`,
      [userId, subscription.endpoint, subscription.p256dh, subscription.auth, userAgent.slice(0, 400)]
    );
  },

  async removeSubscription(userId, endpoint) {
    await query(`DELETE FROM v2_push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [userId, endpoint]);
  },

  async hasSubscription(userId) {
    const row = await queryOne<{ found: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM v2_push_subscriptions WHERE user_id = $1) AS found`,
      [userId]
    );
    return row?.found ?? false;
  },

  // ─── The dispatcher ────────────────────────────────────────────────────
  async claimDueCampaign(now, staleBefore) {
    const row = await queryOne<CampaignRow>(
      `WITH next AS (
         SELECT id FROM v2_notification_campaigns
          WHERE (status = 'scheduled' AND scheduled_at <= $1) OR (status = 'sending' AND started_at < $2)
          ORDER BY scheduled_at
          LIMIT 1
            FOR UPDATE SKIP LOCKED)
       UPDATE v2_notification_campaigns c SET status = 'sending', started_at = $1, updated_at = $1
         FROM next WHERE c.id = next.id
       RETURNING ${CAMPAIGN_COLUMNS}`,
      [now, staleBefore]
    );
    return row ? toCampaign(row) : null;
  },

  async finishCampaign(id, outcome) {
    if (outcome.status === 'sent') {
      await query(
        `UPDATE v2_notification_campaigns SET status = 'sent', sent_at = now(), recipient_count = $2, error = '', updated_at = now()
          WHERE id = $1 AND status = 'sending'`,
        [id, outcome.recipients]
      );
      await audit(id, null, 'sent', { recipients: outcome.recipients });
    } else {
      await query(
        `UPDATE v2_notification_campaigns SET status = 'failed', error = $2, updated_at = now() WHERE id = $1 AND status = 'sending'`,
        [id, outcome.error.slice(0, 400)]
      );
      await audit(id, null, 'failed', { error: outcome.error.slice(0, 400) });
    }
  },

  async claimDueDeliveries(now, limit, leaseUntil) {
    const rows = await query<{
      id: string;
      attempts: number;
      notification_id: string;
      subscription_id: string | null;
      endpoint: string | null;
      p256dh: string | null;
      auth: string | null;
      title: string;
      body: string;
    }>(
      `WITH due AS (
         SELECT id FROM v2_notification_deliveries
          WHERE status = 'queued' AND next_attempt_at <= $1
          ORDER BY next_attempt_at
          LIMIT $2
            FOR UPDATE SKIP LOCKED),
       leased AS (
         UPDATE v2_notification_deliveries d
            SET attempts = d.attempts + 1, last_attempt_at = $1, next_attempt_at = $3
           FROM due WHERE d.id = due.id
         RETURNING d.id, d.attempts, d.notification_id, d.subscription_id)
       SELECT l.id::text, l.attempts, l.notification_id, l.subscription_id, s.endpoint, s.p256dh, s.auth, n.title, n.body
         FROM leased l
         JOIN v2_notifications n ON n.id = l.notification_id
         LEFT JOIN v2_push_subscriptions s ON s.id = l.subscription_id`,
      [now, limit, leaseUntil]
    );
    return rows.map((row) =>
      row.subscription_id && row.endpoint
        ? {
            id: row.id,
            subscriptionId: row.subscription_id,
            endpoint: row.endpoint,
            p256dh: row.p256dh!,
            auth: row.auth!,
            attempts: row.attempts,
            notificationId: row.notification_id,
            title: row.title,
            body: row.body,
          }
        : { id: row.id, subscriptionId: null }
    );
  },

  async recordDeliveries(results) {
    if (results.length === 0) return;
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE v2_notification_deliveries d
            SET status = r.status::v2_notification_delivery_status,
                error = r.error,
                sent_at = CASE WHEN r.status = 'sent' THEN now() ELSE d.sent_at END,
                next_attempt_at = coalesce(r.next_attempt_at, d.next_attempt_at)
           FROM unnest($1::bigint[], $2::text[], $3::text[], $4::timestamptz[]) AS r (id, status, error, next_attempt_at)
          WHERE d.id = r.id`,
        [
          results.map((r) => r.id),
          results.map((r) => (r.status === 'retry' ? 'queued' : r.status)),
          results.map((r) => (r.status === 'sent' ? '' : r.error.slice(0, 400))),
          results.map((r) => (r.status === 'retry' ? r.nextAttemptAt : null)),
        ]
      );
      const sentTo = results.flatMap((r) => (r.status === 'sent' ? [r.id] : []));
      if (sentTo.length) {
        await client.query(
          `UPDATE v2_push_subscriptions s SET last_success_at = now()
             FROM v2_notification_deliveries d WHERE d.subscription_id = s.id AND d.id = ANY($1::bigint[])`,
          [sentTo]
        );
      }
      // A subscription the push service says is gone is forgotten.
      const gone = results.flatMap((r) => (r.status === 'failed' && r.forgetSubscriptionId ? [r.forgetSubscriptionId] : []));
      if (gone.length) await client.query(`DELETE FROM v2_push_subscriptions WHERE id = ANY($1::uuid[])`, [gone]);
    });
  },

  async purge(now, retention) {
    const day = 24 * 60 * 60;
    return {
      notification_deliveries: await deleteInBatches(
        'v2_notification_deliveries',
        `status <> 'queued' AND created_at < $1::timestamptz - make_interval(secs => $2)`,
        [now, retention.deliveryDays * day]
      ),
      notifications: await deleteInBatches(
        'v2_notifications',
        'created_at < $1::timestamptz - make_interval(secs => $2)',
        [now, retention.notificationDays * day]
      ),
    };
  },

  // ─── Campaigns ─────────────────────────────────────────────────────────
  async listCampaigns(filter) {
    const rows = await query<CampaignRow & { total: number }>(
      `SELECT ${CAMPAIGN_COLUMNS}, count(*) OVER ()::int AS total
         FROM v2_notification_campaigns c
        WHERE ($1::text IS NULL OR c.title ILIKE '%' || $1 || '%' OR c.body ILIKE '%' || $1 || '%')
          AND ($2::v2_notification_campaign_status IS NULL OR c.status = $2)
          AND ($2::v2_notification_campaign_status IS NOT NULL OR c.status <> 'archived')
     ORDER BY c.updated_at DESC, c.id
        LIMIT $3 OFFSET $4`,
      [
        filter.search ? filter.search.replace(/[\\%_]/g, (char) => `\\${char}`) : null,
        filter.status ?? null,
        filter.pageSize,
        (filter.page - 1) * filter.pageSize,
      ]
    );
    return { items: rows.map(toCampaign), total: rows[0]?.total ?? 0 };
  },

  async findCampaign(id) {
    const row = await queryOne<CampaignRow>(`SELECT ${CAMPAIGN_COLUMNS} FROM v2_notification_campaigns c WHERE c.id = $1`, [id]);
    return row ? toCampaign(row) : null;
  },

  async createCampaign(fields, adminId) {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO v2_notification_campaigns
              (title, body, category, image_media_id, destination, audience, push, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING id`,
      [fields.title, fields.body, fields.category, fields.imageId, JSON.stringify(fields.destination), JSON.stringify(fields.audience), fields.push, adminId]
    );
    await audit(row!.id, adminId, 'create', { title: fields.title });
    return row!.id;
  },

  async updateDraft(id, fields, adminId) {
    const rows = await query(
      `UPDATE v2_notification_campaigns
          SET title = $2, body = $3, category = $4, image_media_id = $5, destination = $6, audience = $7, push = $8,
              updated_by = $9, updated_at = now()
        WHERE id = $1 AND status = 'draft' RETURNING id`,
      [id, fields.title, fields.body, fields.category, fields.imageId, JSON.stringify(fields.destination), JSON.stringify(fields.audience), fields.push, adminId]
    );
    if (rows.length === 0) return false;
    await audit(id, adminId, 'update', { title: fields.title });
    return true;
  },

  async transition(id, move, adminId) {
    const rows = await query(
      `UPDATE v2_notification_campaigns
          SET status = $2::v2_notification_campaign_status,
              scheduled_at = CASE WHEN $4::boolean THEN $5::timestamptz ELSE scheduled_at END,
              updated_by = $6, updated_at = now()
        WHERE id = $1 AND status = ANY($3::v2_notification_campaign_status[]) RETURNING id`,
      [id, move.to, move.from, move.scheduledAt !== undefined, move.scheduledAt ?? null, adminId]
    );
    if (rows.length === 0) return false;
    await audit(id, adminId, move.action, move.details);
    return true;
  },

  async cancelQueuedPushes(id, adminId) {
    const rows = await query(
      `UPDATE v2_notification_deliveries SET status = 'cancelled', error = 'لغو شد'
        WHERE campaign_id = $1 AND status = 'queued' RETURNING id`,
      [id]
    );
    await audit(id, adminId, 'push_stopped', { cancelled: rows.length });
    return rows.length;
  },

  async audit(id, adminId, action, details) {
    await audit(id, adminId, action, details);
  },

  async report(id) {
    const row = await queryOne<{
      recipients: number;
      read: number;
      opened: number;
      dismissed: number;
      queued: number;
      sent: number;
      failed: number;
      cancelled: number;
    }>(
      `SELECT count(*)::int AS recipients,
              count(*) FILTER (WHERE read_at IS NOT NULL)::int AS read,
              count(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
              count(*) FILTER (WHERE dismissed_at IS NOT NULL)::int AS dismissed,
              (SELECT count(*) FROM v2_notification_deliveries d WHERE d.campaign_id = $1 AND d.status = 'queued')::int AS queued,
              (SELECT count(*) FROM v2_notification_deliveries d WHERE d.campaign_id = $1 AND d.status = 'sent')::int AS sent,
              (SELECT count(*) FROM v2_notification_deliveries d WHERE d.campaign_id = $1 AND d.status = 'failed')::int AS failed,
              (SELECT count(*) FROM v2_notification_deliveries d WHERE d.campaign_id = $1 AND d.status = 'cancelled')::int AS cancelled
         FROM v2_notifications WHERE campaign_id = $1`,
      [id]
    );
    return {
      recipients: row?.recipients ?? 0,
      read: row?.read ?? 0,
      opened: row?.opened ?? 0,
      dismissed: row?.dismissed ?? 0,
      push: { queued: row?.queued ?? 0, sent: row?.sent ?? 0, failed: row?.failed ?? 0, cancelled: row?.cancelled ?? 0 },
    };
  },

  async history(id) {
    const rows = await query<{ id: string; action: string; admin_name: string | null; details: Record<string, unknown>; created_at: Date }>(
      `SELECT l.id::text, l.action, nullif(trim(a.first_name || ' ' || a.last_name), '') AS admin_name, l.details, l.created_at
         FROM v2_notification_audit_log l
         LEFT JOIN v2_admin_users a ON a.id = l.admin_id
        WHERE l.campaign_id = $1
     ORDER BY l.created_at DESC, l.id DESC
        LIMIT 100`,
      [id]
    );
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      admin: row.admin_name,
      details: row.details,
      createdAt: row.created_at.toISOString(),
    }));
  },

  async overview() {
    const rows = await query<{ status: CampaignStatus; count: number; recipients: number }>(
      `SELECT status, count(*)::int AS count, coalesce(sum(recipient_count), 0)::int AS recipients
         FROM v2_notification_campaigns GROUP BY status`
    );
    const push = await queryOne<{ sent: number; failed: number }>(
      `SELECT count(*) FILTER (WHERE status = 'sent')::int AS sent, count(*) FILTER (WHERE status = 'failed')::int AS failed
         FROM v2_notification_deliveries WHERE campaign_id IS NOT NULL`
    );
    const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<CampaignStatus, number>;
    for (const row of rows) byStatus[row.status] = row.count;
    return {
      total: rows.reduce((sum, row) => sum + row.count, 0),
      byStatus,
      recipients: rows.reduce((sum, row) => sum + (row.status === 'sent' ? row.recipients : 0), 0),
      push: { sent: push?.sent ?? 0, failed: push?.failed ?? 0 },
    };
  },

  async estimate(audience, category, destination) {
    const { values, add } = params();
    const eligible = eligibleRecipients({ kind: 'audience', audience }, category, destination, add);
    const row = await queryOne<{ eligible: number; push: number }>(
      `WITH eligible AS (${eligible})
       SELECT count(*)::int AS eligible,
              count(*) FILTER (WHERE e.push AND EXISTS (SELECT 1 FROM v2_push_subscriptions s WHERE s.user_id = e.user_id))::int AS push
         FROM eligible e`,
      values
    );
    return { eligible: row?.eligible ?? 0, push: row?.push ?? 0 };
  },

  async destinationExists(destination) {
    if (destination.kind === 'event') {
      const row = await queryOne(
        `SELECT 1 FROM v2_events e WHERE e.id = $1 AND e.status IN ('published', 'cancelled') AND e.publish_at <= now()`,
        [destination.eventId]
      );
      return Boolean(row);
    }
    if (destination.kind === 'activity') {
      const row = await queryOne(`SELECT 1 FROM v2_engagement_activities WHERE id = $1 AND status = 'published'`, [
        destination.activityId,
      ]);
      return Boolean(row);
    }
    return true;
  },

  async options() {
    const [events, activities, worlds] = await Promise.all([
      query<{ id: string; title: string; visibility: 'public' | 'world' | 'restricted' }>(
        `SELECT id, title, visibility FROM v2_events
          WHERE status IN ('published', 'cancelled') AND (end_at IS NULL OR end_at > now() - interval '7 days')
       ORDER BY start_at NULLS LAST LIMIT 200`
      ),
      query<{ id: string; title: string }>(
        `SELECT id, title FROM v2_engagement_activities WHERE status = 'published' ORDER BY created_at DESC LIMIT 200`
      ),
      query<{ id: string; name: string }>(`SELECT id, name FROM v2_worlds WHERE status = 'published' ORDER BY position, name`),
    ]);
    return { events, activities, worlds };
  },
};
