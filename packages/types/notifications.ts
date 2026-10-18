import type { CampaignCategoryId, NotificationCategoryId } from '@hamdastan/config';

/**
 * Notifications (اعلان‌ها) — the wire contract. One notification model
 * serves what the system sends on its own (XP, badges, an event's news) and
 * what an admin sends as a campaign; both land in the same inbox, obey the
 * same preferences and open through the same deep link.
 *
 * Times are ISO strings.
 */

export type NotificationCategory = NotificationCategoryId;
export type CampaignCategory = CampaignCategoryId;

/**
 * Where a notification leads. Never a URL: the API turns it into one of the
 * product's own paths when it is opened, after checking the person may
 * still go there.
 */
export type NotificationDestination =
  | { kind: 'none' }
  | { kind: 'home' }
  | { kind: 'events' }
  | { kind: 'my_events' }
  | { kind: 'activities' }
  | { kind: 'profile' }
  | { kind: 'event'; eventId: string }
  | { kind: 'activity'; activityId: string };

export type NotificationDestinationKind = NotificationDestination['kind'];

// ─── Product ─────────────────────────────────────────────────────────────────

/** One row of the Notification Center. */
export type NotificationItem = {
  id: string;
  category: NotificationCategory;
  /** What happened, e.g. `xp_earned`, `event_cancelled`, `campaign`. */
  type: string;
  title: string;
  body: string;
  imageId: string | null;
  /** Whether opening it leads somewhere. */
  actionable: boolean;
  read: boolean;
  /** Past its relevance — an event that has ended, a reminder for one that started. */
  expired: boolean;
  createdAt: string;
};

/** `GET /notifications` — newest first, by cursor. */
export type NotificationInbox = {
  items: NotificationItem[];
  /** Pass back as `before` for the next page; null on the last. */
  nextCursor: string | null;
  /** Unread and not dismissed, across every category. */
  unread: number;
};

/** The Center's tabs: everything, the unread, or one category. */
export type NotificationFilter = 'all' | 'unread' | NotificationCategory;

/** `POST /notifications/:id/open` — the path to go to, or null when it is no longer there for this person. */
export type NotificationOpenResult = { href: string | null };

export type NotificationPreference = {
  category: Exclude<NotificationCategory, 'system'>;
  /** Receive it at all. */
  inApp: boolean;
  /** Also on the phone, when this device is subscribed. */
  push: boolean;
};

/** `GET /notifications/preferences`. */
export type NotificationPreferences = {
  categories: NotificationPreference[];
  /** Whether the API can send push at all; the public key a browser subscribes with. */
  push: { available: boolean; publicKey: string | null };
};

/** `POST /notifications/push/subscriptions` — the browser's `PushSubscription`, as JSON. */
export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// ─── Admin ───────────────────────────────────────────────────────────────────

/**
 * Who a campaign goes to. The first three are Engagement Studio's own
 * audience; `event` is people with a verified relationship to one event —
 * interest is not a booking, so they are separate — and `world` is people
 * who are interested in or confirmed for an event filed under the worlds.
 * There is no world membership or following yet, so nothing else can be
 * meant by a world's audience.
 */
export type NotificationAudience =
  | { kind: 'all' }
  | { kind: 'users'; phones: string[] }
  | { kind: 'interests'; categoryIds: string[] }
  | { kind: 'event'; eventId: string; relation: 'interested' | 'confirmed' }
  | { kind: 'world'; worldIds: string[] };

export type NotificationAudienceKind = NotificationAudience['kind'];

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed' | 'archived';

/** `POST /admin/notifications/campaigns` and `PUT …/:id` (a draft only). */
export type CampaignInput = {
  title: string;
  body: string;
  category: CampaignCategory;
  imageId: string | null;
  destination: NotificationDestination;
  audience: NotificationAudience;
  /** Push as well as in-app. In-app is always on. */
  push: boolean;
};

/** `POST /admin/notifications/campaigns/:id/send` — null sends now. */
export type CampaignSendInput = { scheduledAt: string | null };

export type CampaignListQuery = {
  search?: string;
  status?: CampaignStatus;
  page?: number;
};

export type AdminCampaignSummary = {
  id: string;
  title: string;
  category: CampaignCategory;
  audience: NotificationAudience;
  push: boolean;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  /** Notifications created; null until it is sent. */
  recipientCount: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCampaign = AdminCampaignSummary & {
  body: string;
  imageId: string | null;
  destination: NotificationDestination;
  startedAt: string | null;
  /** Why it failed, when it did. */
  error: string;
};

/**
 * What can be measured, and only that. A push accepted by the browser's push
 * service is «sent» — it is not proof the phone showed it, and nothing here
 * calls it delivered.
 */
export type CampaignReport = {
  recipients: number;
  read: number;
  opened: number;
  dismissed: number;
  push: { queued: number; sent: number; failed: number; cancelled: number };
};

export type CampaignHistoryEntry = {
  id: string;
  action: string;
  admin: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

/** `GET /admin/notifications/overview`. */
export type NotificationsOverview = {
  total: number;
  byStatus: Record<CampaignStatus, number>;
  /** Notifications created by sent campaigns. */
  recipients: number;
  push: { available: boolean; sent: number; failed: number };
};

/** `POST /admin/notifications/audience` — who a campaign would reach today. */
export type AudienceEstimate = {
  /** Active people in the audience who have not switched the category off. */
  eligible: number;
  /** Of those, how many have a phone subscribed and push left on. */
  push: number;
};

/** What a campaign may point at or be sent about, for the form's pickers. */
export type CampaignOptions = {
  events: { id: string; title: string; visibility: 'public' | 'world' | 'restricted' }[];
  activities: { id: string; title: string }[];
  worlds: { id: string; name: string }[];
  pushAvailable: boolean;
};

/** The stable `code` values the panel and the product switch on. */
export const NOTIFICATION_ERROR_CODES = {
  CAMPAIGN_INVALID_TRANSITION: 'CAMPAIGN_INVALID_TRANSITION',
  CAMPAIGN_NOT_EDITABLE: 'CAMPAIGN_NOT_EDITABLE',
  /** The campaign asks for push, and the API has no push service. */
  PUSH_UNAVAILABLE: 'PUSH_UNAVAILABLE',
  /** The destination does not exist, or may not be sent to this audience. */
  DESTINATION_UNAVAILABLE: 'DESTINATION_UNAVAILABLE',
} as const;
