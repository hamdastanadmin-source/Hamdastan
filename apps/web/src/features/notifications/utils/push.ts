import type { PushSubscriptionInput } from '@hamdastan/types';

/**
 * This browser's Web Push subscription. Subscribing is the browser's own
 * API — it registers with its vendor's push service itself — and the result
 * goes to `apps/api` alone, which is the only thing that ever sends to it.
 */

const SW_PATH = '/sw.js';

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** The VAPID key arrives base64url; `subscribe` wants its bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration ? registration.pushManager.getSubscription() : null;
}

/** Asks for permission (only ever from a tap) and subscribes. Null when the person said no. */
export async function subscribeDevice(publicKey: string): Promise<PushSubscriptionInput | null> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const json = subscription.toJSON();
  return { endpoint: subscription.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } };
}

/** Answers the endpoint it removed, so the API can forget it too. */
export async function unsubscribeDevice(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  await subscription.unsubscribe();
  return subscription.endpoint;
}
