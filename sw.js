/* UWAIS FOOD ADMIN PWA — v11.10.3 Order Workspace Clean Layout
 * Network-first navigation, versioned app shell, user-approved update activation.
 * API requests use POST and are never cached.
 */
const CACHE_PREFIX = 'uwais-food-admin-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v11-10-3-order-workspace-20261114';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

function scopedUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_FILES.map(async path => {
      const url = scopedUrl(path);
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response && response.ok) await cache.put(url, response.clone());
      } catch (_) { /* Online launch will populate the shell cache. */ }
    }));
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) || key.startsWith('uwais-food-shell-')
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(scopedUrl('./index.html'), response.clone());
        }
        return response;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match(scopedUrl('./index.html'))) ||
          new Response('Uwais Food Admin sedang offline. Hubungkan internet untuk memuat versi terbaru.', {
            status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}
          });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return new Response('', {status: 504, statusText: 'Offline'});
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        try { client.postMessage({type: 'customer-order-notification'}); } catch (_) {}
        return;
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(new URL('./', self.registration.scope).toString());
    }
  })());
});
