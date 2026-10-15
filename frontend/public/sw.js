// Minimal service worker: caches the app shell (HTML/CSS/JS/icons) so the
// app opens instantly and works on a flaky connection, while always going
// to the network for API calls so order data is never stale.
const CACHE_NAME = "shop-sa-shell-v2";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only handle our own app shell. Anything cross-origin (the API, fonts) and
  // anything under /api/ goes straight to the network, untouched.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache good responses.
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        // Offline: serve from cache, then the cached app shell. respondWith()
        // must always get a real Response (previously this could resolve to
        // undefined and throw "Failed to convert value to 'Response'").
        const cached = await caches.match(request);
        if (cached) return cached;
        const shell = await caches.match("/");
        if (shell) return shell;
        return Response.error();
      })
  );
});




