// Deva Construction — Service Worker
// Cache-first for static shell assets, network-only for authenticated
// dashboard/API routes (never cache sensitive project/payment data).
// Falls back to /offline.html when the network is unavailable.

const CACHE_VERSION = "deva-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const SHELL_ASSETS = [
  "/offline.html",
  "/icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Routes that must NEVER be cached (authenticated, sensitive data)
const NO_CACHE_PATTERNS = [
  /\/api\//,
  /\/auth\//,
  /supabase/,
  /_next\/data/,
];

// Static assets safe to cache (immutable hashed filenames from Next.js)
const CACHEABLE_STATIC = /\/_next\/static\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache authenticated/API routes
  if (NO_CACHE_PATTERNS.some((p) => p.test(url.pathname + url.search))) return;

  // Cache-first for hashed Next.js static assets (JS/CSS chunks)
  if (CACHEABLE_STATIC.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Shell assets — cache-first
  if (SHELL_ASSETS.some((asset) => url.pathname === asset)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // All other navigation requests — network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Everything else — network only (don't cache page-specific HTML/JSON)
  event.respondWith(fetch(request));
});
