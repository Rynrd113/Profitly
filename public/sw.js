const STATIC_CACHE = 'profitly-static-v1';
const PAGE_CACHE = 'profitly-pages-v1';
const FONT_CACHE = 'profitly-fonts-v1';

// Cache static Next.js bundles forever (content-addressed filenames)
const isStatic = (url) => url.pathname.startsWith('/_next/static/');

// Cache Google Fonts
const isFont = (url) =>
  url.hostname === 'fonts.googleapis.com' ||
  url.hostname === 'fonts.gstatic.com';

// Pages to pre-cache on install
const PRECACHE_PAGES = ['/calculator'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(PRECACHE_PAGES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const current = new Set([STATIC_CACHE, PAGE_CACHE, FONT_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => !current.has(n)).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Static bundles: cache-first (safe, content-addressed)
  if (sameOrigin && isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
            return res;
          })
      )
    );
    return;
  }

  // Google Fonts: stale-while-revalidate
  if (isFont(url)) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request).then((res) => {
            cache.put(request, res.clone());
            return res;
          });
          return cached || network;
        })
      )
    );
    return;
  }

  // Same-origin pages: network-first, fall back to cache
  if (sameOrigin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
  }
});
