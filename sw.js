/* UWAIS FOOD PWA — cache version v9.1
 * Static shell cache + network-first navigation + explicit user-approved updates.
 */
const CACHE_PREFIX = 'uwais-food-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v9-1-20261104';
const SHELL_FILES = [
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png'
];

function scopedUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_FILES.map(async path => {
      const url = scopedUrl(path);
      const response = await fetch(url, {cache: 'reload'});
      if (response && response.ok) await cache.put(url, response.clone());
    }));

    // Notify already-running app windows only when this is an update, not first install.
    if (self.registration.active) {
      const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
      windows.forEach(client => client.postMessage({type: 'update'}));
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return; // Apps Script API calls use POST; never cache them.

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(scopedUrl('index.html'), response.clone());
        }
        return response;
      } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match(scopedUrl('index.html')))
          || new Response('Uwais Food sedang offline. Hubungkan internet untuk memuat aplikasi pertama kali.', {
            status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}
          });
      }
    })());
    return;
  }

  // Cache-first for the app shell and local static assets.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      return new Response('', {status: 504, statusText: 'Offline'});
    }
  })());
});
