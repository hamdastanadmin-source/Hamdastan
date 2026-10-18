/**
 * Types internal to the Notifications module. The wire shapes are in
 * `@hamdastan/types` (`NotificationItem`, `AdminCampaign`, …).
 */

import type {
  CampaignCategory,
  CampaignStatus,
  NotificationAudience,
  NotificationCategory,
  NotificationDestination,
} from '@hamdastan/types';

/** What one notification says, whoever it goes to. */
export type NotificationContent = {
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  imageId: string | null;
  destination: NotificationDestination;
  /** Names the notification: a recipient holds at most one per key. */
  dedupeKey: string;
  expiresAt: Date | null;
  campaignId: string | null;
  /** Whether this kind of notification may reach a phone at all; the person's switch still decides. */
  push: boolean;
};

/**
 * Who it goes to — always active accounts, always filtered by their
 * preferences and, for a destination they could not open, by that too.
 */
export type Recipients =
  | { kind: 'user'; userId: string }
  /** Interested, or holding a pending or confirmed booking. */
  | { kind: 'event_followers'; eventId: string }
  /** Interested with the in-app reminder on, or holding a confirmed booking. */
  | { kind: 'event_reminder'; eventId: string }
  | { kind: 'booking'; bookingId: string }
  | { kind: 'audience'; audience: NotificationAudience };

export type DeliverOutcome = { created: number; queued: number };

export type InboxRow = {
  id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  imageId: string | null;
  destination: NotificationDestination;
  expiresAt: Date | null;
  createdAt: Date;
  readAt: Date | null;
};

/** PostgreSQL's own text for the timestamp, so microseconds survive the round trip. */
export type InboxCursor = { createdAt: string; id: string };

export type PreferenceRow = { category: string; inApp: boolean; push: boolean };

export type DueEvent = { id: string; title: string; startAt: Date; endAt: Date | null };

export type EventSummary = { id: string; title: string; startAt: Date | null; endAt: Date | null };

export type DeliveryJob = {
  id: string;
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  attempts: number;
  notificationId: string;
  title: string;
  body: string;
};

export type DeliveryResult =
  | { id: string; status: 'sent' }
  | { id: string; status: 'retry'; error: string; nextAttemptAt: Date }
  | { id: string; status: 'failed'; error: string; forgetSubscriptionId?: string };

export type CampaignFields = {
  title: string;
  body: string;
  category: CampaignCategory;
  imageId: string | null;
  destination: NotificationDestination;
  audience: NotificationAudience;
  push: boolean;
};

export type CampaignRecord = CampaignFields & {
  id: string;
  status: CampaignStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  sentAt: Date | null;
  recipientCount: number | null;
  error: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CampaignFilter = { search?: string; status?: CampaignStatus; page: number; pageSize: number };

/** A status move: the statuses it may start from, and what it writes. */
export type CampaignTransition = {
  to: CampaignStatus;
  from: CampaignStatus[];
  scheduledAt?: Date | null;
  action: string;
  details?: Record<string, unknown>;
};
