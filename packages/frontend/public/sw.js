// Kill-switch service worker — unregisters itself and wipes all caches.
// Once every active client has loaded this, the SW will be gone and the
// page will fetch fresh assets from the network on every load.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. Delete every cache this origin owns
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));

    // 2. Unregister this service worker
    await self.registration.unregister();

    // 3. Force every open tab/window to reload so they pick up the
    //    fresh HTML and asset references with no SW intercepting them.
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});

// While the kill-switch is active, never intercept anything — pass through
self.addEventListener('fetch', () => {});
