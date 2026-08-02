// Exists purely to satisfy Chrome's PWA installability requirement
// (manifest + a registered service worker with a fetch handler + HTTPS).
// Deliberately does NOT cache pages or API responses: this is a live
// dashboard with real-time-sensitive data (payments, project status), and
// serving a stale cached page would misrepresent that data. Only the app
// icon itself is cached.
const CACHE = "deva-construction-shell-v1";
const SHELL_ASSETS = ["/icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.endsWith("/icon.png")) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    return;
  }
  event.respondWith(fetch(event.request));
});
