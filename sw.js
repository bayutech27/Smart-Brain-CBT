// ===== VERSION =====
const CACHE_NAME = "smartbrain-v3";

// ===== STATIC ASSETS (NO HTML HERE) =====
const STATIC_ASSETS = [
  "/style.css",
  "/auth.js",
  "/dashboard.js"
];

// ===== INSTALL =====
self.addEventListener("install", (event) => {
  self.skipWaiting(); // activate immediately

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// ===== ACTIVATE =====
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // delete old cache
          }
        })
      );
    })
  );

  self.clients.claim(); // take control immediately
});

// ===== FETCH STRATEGY =====
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // ✅ 1. HTML → NETWORK FIRST (CRITICAL FIX)
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ✅ 2. JS/CSS/Assets → CACHE FIRST
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, response.clone());
          return response;
        });
      });
    })
  );
});