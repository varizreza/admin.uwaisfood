const C = 'uwais-food-v11';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const INDEX = () => new URL('index.html', self.registration.scope).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function notify() {
  const cs = await self.clients.matchAll({includeUncontrolled: true});
  cs.forEach(c => c.postMessage({type: 'update'}));
}

// Cache dulu (instan & jalan offline), lalu perbarui diam-diam di latar belakang.
// Jika index.html di server berubah, halaman menampilkan banner "Versi baru tersedia".
async function swr(e, key) {
  const cache = await caches.open(C);
  const hit = await cache.match(key, {ignoreSearch: true});
  const update = fetch(key, {cache: 'no-store'}).then(async r => {
    if (r && r.ok) {
      let changed = false;
      if (hit && key === INDEX()) {
        try { changed = (await hit.clone().text()) !== (await r.clone().text()); } catch (_) {}
      }
      await cache.put(key, r.clone());
      if (changed) notify();
    }
    return r;
  }).catch(() => null);
  if (hit) { e.waitUntil(update); return hit; }
  const r = await update;
  return r || (await cache.match(INDEX())) || Response.error();
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // Apps Script (domain lain) tidak disentuh
  const key = e.request.mode === 'navigate' ? INDEX() : e.request.url;
  e.respondWith(swr(e, key));
});
