// ===== VERSION =====
const CACHE_VERSION = 'v4'; // Increment this with each update
const CACHE_NAME = `smartbrain-${CACHE_VERSION}`;

// ===== STATIC ASSETS =====
const STATIC_ASSETS = [
  "/",
  "/style.css",
  "/auth.js",
  "/dashboard.js"
  // Add your main HTML/entry file if different from "/"
];

// ===== INSTALL =====
self.addEventListener("install", (event) => {
  console.log('[SW] Installing new version:', CACHE_VERSION);
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Add each asset individually with error handling
      const addPromises = STATIC_ASSETS.map(async (asset) => {
        try {
          const response = await fetch(asset);
          if (response.ok) {
            await cache.put(asset, response);
          } else {
            console.warn(`[SW] Failed to cache ${asset}: ${response.status}`);
          }
        } catch (error) {
          console.warn(`[SW] Error caching ${asset}:`, error);
        }
      });
      
      await Promise.all(addPromises);
      console.log('[SW] Cache populated with version:', CACHE_VERSION);
    })
  );
});

// ===== ACTIVATE =====
self.addEventListener("activate", (event) => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all caches that don't match current version
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// ===== FETCH STRATEGY =====
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // ✅ 1. DON'T CACHE API ENDPOINTS
  if (url.pathname.startsWith('/api/') || 
      url.pathname.includes('/auth/') ||
      url.pathname.includes('/login') ||
      url.pathname.includes('/logout')) {
    // Network-only for API/auth requests
    event.respondWith(fetch(request));
    return;
  }
  
  // ✅ 2. HTML → NETWORK FIRST (with proper fallback)
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Fallback to cached HTML
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            console.log('[SW] Serving cached HTML for:', request.url);
            return cachedResponse;
          }
          // Return offline page if you have one
          return new Response('Offline - Please check your connection', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }
  
  // ✅ 3. JS/CSS/Assets → CACHE FIRST, NETWORK FALLBACK
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version, but update in background
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      
      // No cache - fetch from network
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});

// ✅ 4. Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Force check for updates
  if (event.data === 'CHECK_UPDATE') {
    self.registration.update();
  }
});