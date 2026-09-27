/* Chhinzer Track – service worker
   Caches the app shell so the app opens and runs with no internet connection.
   It only manages its own Cache Storage entries. It never touches IndexedDB,
   where all fitness data lives, so updating the app can never delete records.
   To ship an update: change CACHE_VERSION, upload all files, reopen the app. */
const CACHE_PREFIX = 'chhinzer-track-';
const CACHE_VERSION = 'v1';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL.map(u => new Request(u, {cache: 'reload'}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Stale-while-revalidate for same-origin GET requests:
   answer instantly from the cache (works offline), then refresh the cached copy in the background when online. */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('./index.html') || await cache.match('./');
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      }).catch(() => null);
      if (cached) { event.waitUntil(network); return cached; }
      const res = await network;
      return res || new Response('<!doctype html><meta name="viewport" content="width=device-width"><title>Chhinzer Track</title><p style="font:17px -apple-system,sans-serif;padding:40px 20px">Open the app once while online to finish installing it for offline use.</p>',
        {headers: {'Content-Type': 'text/html; charset=utf-8'}});
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, {ignoreSearch: true});
    const network = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    const res = await network;
    return res || new Response('', {status: 504, statusText: 'Offline'});
  })());
});
