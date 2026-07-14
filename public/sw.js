const CACHE_NAME = 'mars-xenowake-v4-living-mars';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/assets/xenowake-key-art.webp',
  '/models/nix-alien.glb',
  '/models/ari-scout.glb',
  '/models/guardian-drone.glb',
  '/models/mars-crawler.glb',
  '/models/signal-beacon.glb',
  '/models/frontier-outpost.glb',
  '/models/crash-portal.glb',
  '/models/xenite-cluster.glb',
  '/models/martian-rock.glb',
  '/models/wrecked-shuttle.glb',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL.filter((url) => url !== '/'));

      const shellResponse = await fetch('/');
      if (!shellResponse.ok) throw new Error(`Unable to precache app shell: ${shellResponse.status}`);
      const shellMarkup = await shellResponse.clone().text();
      const runtimeAssets = Array.from(
        shellMarkup.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g),
        (match) => match[1],
      );

      await cache.put('/', shellResponse);
      if (runtimeAssets.length > 0) await cache.addAll(runtimeAssets);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
