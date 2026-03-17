const CACHE_NAME = 'glide-hims-v13';
const STATIC_ASSETS = [
  '/favicon.svg',
  '/logo.svg',
  '/manifest.json',
];

// Safe cache put — skip partial (206) and non-ok responses
function safeCachePut(request, response) {
  if (!response || !response.ok || response.status === 206) return;
  const clone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, clone).catch(() => {}));
}

// Install: cache static assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for navigations & API, cache-first for hashed assets only
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle http/https — ignore chrome-extension://, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // HTML navigations: network-first, fallback to cache or offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) safeCachePut(event.request, response);
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) =>
            cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } })
          )
        )
    );
    return;
  }

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (event.request.method === 'GET') safeCachePut(event.request, response);
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) =>
            cached || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })
          )
        )
    );
    return;
  }

  // Static assets: cache-first (Vite hashes filenames so stale cache is not an issue)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          safeCachePut(event.request, response);
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((c) =>
            c || new Response('', { status: 503 })
          )
        );
    })
  );
});
