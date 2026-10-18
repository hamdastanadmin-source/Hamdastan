import webPush, { WebPushError } from 'web-push';

import type { PushOutcome, PushSender } from './push-sender';

/** How long a push service keeps an undelivered message for an offline device. */
const TTL_SECONDS = 24 * 60 * 60;

/**
 * Web Push with VAPID — what a browser or an installed PWA subscribes to.
 * Bound in `server.ts` only when the three VAPID variables are set.
 *
 * The status code decides what happens next: 404 and 410 mean the
 * subscription is gone, 429 and 5xx are worth another try, anything else
 * is a refusal that another try would only repeat.
 */
export function createWebPushSender(options: {
  publicKey: string;
  privateKey: string;
  subject: string;
  timeoutMs: number;
}): PushSender {
  const vapidDetails = { subject: options.subject, publicKey: options.publicKey, privateKey: options.privateKey };

  return {
    name: 'web_push',
    publicKey: options.publicKey,
    async send(target, message): Promise<PushOutcome> {
      try {
        await webPush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(message),
          { vapidDetails, TTL: TTL_SECONDS, timeout: options.timeoutMs, urgency: 'normal' }
        );
        return { status: 'sent' };
      } catch (error) {
        if (error instanceof WebPushError) {
          const detail = `HTTP ${error.statusCode}`;
          if (error.statusCode === 404 || error.statusCode === 410) return { status: 'gone', error: detail };
          if (error.statusCode === 429 || error.statusCode >= 500) return { status: 'retry', error: detail };
          return { status: 'failed', error: detail };
        }
        // No answer at all — a timeout or a network failure.
        return { status: 'retry', error: error instanceof Error ? error.message.slice(0, 200) : 'unknown' };
      }
    },
  };
}
