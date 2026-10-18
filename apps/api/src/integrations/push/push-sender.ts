/**
 * The port the notifications module sends push messages through.
 *
 * The service knows that a message has to reach a subscribed browser; it
 * does not know that the protocol is Web Push, that VAPID signs it, or which
 * push service (Google's, Mozilla's, Apple's) the endpoint belongs to.
 */

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** What reaches the service worker. Only what the person's own notification already says. */
export type PushMessage = { title: string; body: string; url: string; tag: string };

/**
 * `sent` — the push service accepted it (not proof the device showed it).
 * `gone` — the subscription no longer exists; it should be forgotten.
 * `retry` — a transient failure (timeout, 429, 5xx); try again later.
 * `failed` — refused for good (a malformed request, a payload too large).
 */
export type PushOutcome =
  | { status: 'sent' }
  | { status: 'gone'; error: string }
  | { status: 'retry'; error: string }
  | { status: 'failed'; error: string };

export interface PushSender {
  /** Human-readable, for logs and delivery records. */
  readonly name: string;
  /** The key a browser subscribes with. */
  readonly publicKey: string;
  send(target: PushTarget, message: PushMessage): Promise<PushOutcome>;
}
