// Service worker kill-switch.
//
// The previous PWA service worker started serving stale JS chunks and stale
// API responses (notably empty queue arrays), making the app appear broken.
// Until we ship a robust caching strategy with versioned cache busting, this
// file uninstalls any previously registered service worker, deletes every
// cache it owned, and reloads open clients exactly once so they pick up
// the live network bundle.
//
// Browsers re-fetch /sw.js whenever a registration update check happens
// (which the previous PWA did on every navigation), so this file will
// replace the old SW for all existing clients within minutes.

self.addEventListener('install', (event) => {
  // Take control immediately, no waiting.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // 1) Drop every cache this origin has ever stored.
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));

        // 2) Take control of any open pages.
        await self.clients.claim();

        // 3) Unregister so the next page load is fully SW-free.
        await self.registration.unregister();

        // 4) Force a one-time reload of every open tab so they drop the
        //    in-memory stale chunks and re-fetch from network.
        const allClients = await self.clients.matchAll({ type: 'window' });
        for (const client of allClients) {
          try {
            client.navigate(client.url);
          } catch (_) {
            // ignore: some clients (cross-origin, prerender) refuse navigate
          }
        }
      } catch (_) {
        // Swallow — best effort cleanup; nothing else we can do here.
      }
    })(),
  );
});

// Make sure we never intercept any request — fall through to network.
self.addEventListener('fetch', () => {
  /* no-op */
});
