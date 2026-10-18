-- ═══════════════════════════════════════════════════════════════════════════
-- 0019 — notifications (اعلان‌ها)
--
-- Additive only: six new tables, two enums, one new admin role value, and a
-- one-time carry-over of the old «ماموریت‌ها و پیشرفت» switch. Nothing
-- existing is altered or dropped.
--
--   v2_notifications                one person's notification: its content,
--                                   where it leads, and its read / opened /
--                                   dismissed state. One row per recipient.
--   v2_notification_campaigns       what an admin writes and sends: content,
--                                   audience, channel, schedule, status.
--   v2_notification_preferences     a person's switches, per category. No row
--                                   means the default (NOTIFICATION_DEFAULTS).
--   v2_push_subscriptions           a browser's Web Push subscription.
--   v2_notification_deliveries      one push attempt-series per notification
--                                   and device: queued → sent / failed /
--                                   cancelled, with the provider's error.
--   v2_notification_audit_log       who did what to a campaign.
--
-- «Only once» is the unique (user_id, dedupe_key): every producer names its
-- notification (`campaign:<id>`, `event-cancelled:<id>`, `badge:<id>` …), so
-- a duplicate domain event or a retried job inserts nothing.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited. The new enum value is
-- not used in this file (PostgreSQL refuses that inside the transaction that
-- adds it).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE v2_admin_role ADD VALUE 'NOTIFICATION_MANAGER';

-- ─── Campaigns ───────────────────────────────────────────────────────────────

CREATE TYPE v2_notification_campaign_status AS ENUM
  ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed', 'archived');

CREATE TABLE v2_notification_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           varchar(80) NOT NULL DEFAULT '',
  body            varchar(240) NOT NULL DEFAULT '',
  category        varchar(20) NOT NULL
    CONSTRAINT v2_notification_campaigns_category CHECK (category IN ('events', 'worlds', 'promotions', 'system')),
  image_media_id  uuid REFERENCES v2_media_assets (id) ON DELETE SET NULL,
  -- NotificationDestination: {"kind": "event", "eventId": "…"} and the rest.
  destination     jsonb NOT NULL DEFAULT '{"kind": "none"}',
  -- NotificationAudience: all / users / interests / event / world.
  audience        jsonb NOT NULL DEFAULT '{"kind": "all"}',
  push            boolean NOT NULL DEFAULT false,
  status          v2_notification_campaign_status NOT NULL DEFAULT 'draft',
  -- UTC, like every timestamptz; the panel shows it in Asia/Tehran.
  scheduled_at    timestamptz,
  started_at      timestamptz,
  sent_at         timestamptz,
  recipient_count integer,
  error           varchar(400) NOT NULL DEFAULT '',
  created_by      uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  updated_by      uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_notification_campaigns_scheduled CHECK (status <> 'scheduled' OR scheduled_at IS NOT NULL)
);

-- The dispatcher's question: what is due.
CREATE INDEX v2_notification_campaigns_due ON v2_notification_campaigns (scheduled_at)
  WHERE status IN ('scheduled', 'sending');
CREATE INDEX v2_notification_campaigns_updated ON v2_notification_campaigns (updated_at DESC);

-- ─── Notifications ───────────────────────────────────────────────────────────

CREATE TABLE v2_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  category        varchar(20) NOT NULL,
  -- What happened: xp_earned, level_up, badge_earned, event_cancelled, campaign …
  type            varchar(40) NOT NULL,
  title           varchar(120) NOT NULL,
  body            varchar(400) NOT NULL DEFAULT '',
  image_media_id  uuid REFERENCES v2_media_assets (id) ON DELETE SET NULL,
  destination     jsonb NOT NULL DEFAULT '{"kind": "none"}',
  campaign_id     uuid REFERENCES v2_notification_campaigns (id) ON DELETE SET NULL,
  dedupe_key      varchar(200) NOT NULL,
  -- Past this it is shown as expired and opens nothing.
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz,
  opened_at       timestamptz,
  dismissed_at    timestamptz,
  CONSTRAINT v2_notifications_once UNIQUE (user_id, dedupe_key)
);

-- The inbox, newest first.
CREATE INDEX v2_notifications_inbox ON v2_notifications (user_id, created_at DESC, id DESC)
  WHERE dismissed_at IS NULL;
-- The unread count.
CREATE INDEX v2_notifications_unread ON v2_notifications (user_id)
  WHERE read_at IS NULL AND dismissed_at IS NULL;
-- A campaign's report.
CREATE INDEX v2_notifications_campaign ON v2_notifications (campaign_id)
  WHERE campaign_id IS NOT NULL;

-- ─── Preferences ─────────────────────────────────────────────────────────────

CREATE TABLE v2_notification_preferences (
  user_id     uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  category    varchar(20) NOT NULL,
  in_app      boolean NOT NULL,
  push        boolean NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

-- ─── Push ────────────────────────────────────────────────────────────────────

CREATE TABLE v2_push_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES v2_users (id) ON DELETE CASCADE,
  -- The push service's address for this browser; it is the subscription's identity.
  endpoint         varchar(1000) NOT NULL CONSTRAINT v2_push_subscriptions_endpoint UNIQUE,
  p256dh           varchar(200) NOT NULL,
  auth             varchar(100) NOT NULL,
  user_agent       varchar(400) NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_success_at  timestamptz
);

CREATE INDEX v2_push_subscriptions_user ON v2_push_subscriptions (user_id);

CREATE TYPE v2_notification_delivery_status AS ENUM ('queued', 'sent', 'failed', 'cancelled');

CREATE TABLE v2_notification_deliveries (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id  uuid NOT NULL REFERENCES v2_notifications (id) ON DELETE CASCADE,
  -- Null once the subscription is gone (expired at the push service, or removed).
  subscription_id  uuid REFERENCES v2_push_subscriptions (id) ON DELETE SET NULL,
  -- Copied from the notification, so a campaign's report needs no join.
  campaign_id      uuid REFERENCES v2_notification_campaigns (id) ON DELETE SET NULL,
  channel          varchar(10) NOT NULL DEFAULT 'push',
  provider         varchar(20) NOT NULL DEFAULT 'web_push',
  status           v2_notification_delivery_status NOT NULL DEFAULT 'queued',
  attempts         integer NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  last_attempt_at  timestamptz,
  -- Accepted by the push service — not proof the device showed it.
  sent_at          timestamptz,
  error            varchar(400) NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_notification_deliveries_once UNIQUE (notification_id, subscription_id)
);

CREATE INDEX v2_notification_deliveries_due ON v2_notification_deliveries (next_attempt_at)
  WHERE status = 'queued';
CREATE INDEX v2_notification_deliveries_campaign ON v2_notification_deliveries (campaign_id, status)
  WHERE campaign_id IS NOT NULL;

-- ─── Audit ───────────────────────────────────────────────────────────────────

CREATE TABLE v2_notification_audit_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id  uuid NOT NULL REFERENCES v2_notification_campaigns (id) ON DELETE CASCADE,
  admin_id     uuid REFERENCES v2_admin_users (id) ON DELETE SET NULL,
  action       varchar(40) NOT NULL,
  details      jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_notification_audit_log_campaign ON v2_notification_audit_log (campaign_id, created_at DESC);

-- ─── Carry-over ──────────────────────────────────────────────────────────────

-- The settings screen's one switch, «ماموریت‌ها و پیشرفت», was stored but
-- read by nothing. Whoever turned it off keeps it off: activity and
-- achievement notifications start switched off for them.
INSERT INTO v2_notification_preferences (user_id, category, in_app, push)
SELECT u.id, c.category, false, false
  FROM v2_users u
 CROSS JOIN (VALUES ('activity'), ('achievements')) AS c (category)
 WHERE u.settings ->> 'notifications' = 'false';
