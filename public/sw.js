const STATIC_CACHE = 'profitly-static-v3';
const PAGE_CACHE   = 'profitly-pages-v3';
const FONT_CACHE   = 'profitly-fonts-v3';

const isStatic = (url) => url.pathname.startsWith('/_next/static/');
const isFont   = (url) =>
  url.hostname === 'fonts.googleapis.com' ||
  url.hostname === 'fonts.gstatic.com';

// Pages pre-cached on install so they're available offline immediately
const PRECACHE_PAGES = ['/', '/dashboard', '/calculator', '/financial-health', '/settings'];

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

  // Static bundles: cache-first (content-addressed, safe to cache forever)
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

  // Same-origin pages: network-first, fall back to cache, then offline shell
  if (sameOrigin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              caches.match('/').then(
                (shell) =>
                  shell ||
                  new Response('<h1>Offline</h1><p>Tidak ada koneksi internet.</p>', {
                    headers: { 'Content-Type': 'text/html' },
                  })
              )
          )
        )
    );
  }
});
