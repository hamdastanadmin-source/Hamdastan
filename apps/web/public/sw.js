/*
 * هم‌داستان's service worker — push notifications only.
 *
 * It caches nothing and intercepts no request: the app works exactly as it
 * does without it. It shows a push the API sent and, when it is tapped,
 * opens `/notifications/<id>`, where the product asks the API where the
 * notification leads — so the destination is re-checked for this person at
 * that moment, never trusted from the payload.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    return;
  }
  if (!message.title) return;

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body || '',
      tag: message.tag,
      dir: 'rtl',
      lang: 'fa',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: message.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Only a path of this app: never an address from somewhere else.
  const path = typeof event.notification.data?.url === 'string' && event.notification.data.url.startsWith('/notifications/')
    ? event.notification.data.url
    : '/notifications';
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) return open.navigate(target).then((client) => (client ?? open).focus());
      return self.clients.openWindow(target);
    })
  );
});
