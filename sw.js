// ===== VERSION =====
const CACHE_VERSION = 'v2'; // Increment with each update
const CACHE_NAME = `smartbrain-${CACHE_VERSION}`;

// ===== STATIC ASSETS - Updated paths to match your actual file structure =====
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/login.html",
  "/css/styles.css",
  "/css/dashboard.css",
  "/js/main.js",
  "/js/auth.js",
  "/js/dashboard.js",
  "/js/script.js",
  "/img/Smart-brain-icon.png"
];

// ===== INSTALL =====
self.addEventListener("install", (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache each asset individually with error handling
      for (const asset of STATIC_ASSETS) {
        try {
          const response = await fetch(asset);
          if (response && response.ok) {
            await cache.put(asset, response);
            console.log(`[SW] Cached: ${asset}`);
          } else {
            console.warn(`[SW] Failed to cache ${asset}: ${response?.status}`);
          }
        } catch (error) {
          console.warn(`[SW] Error caching ${asset}:`, error);
        }
      }
      console.log('[SW] Installation complete');
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
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// ===== FETCH STRATEGY =====
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // NEVER cache API or auth endpoints
  if (url.pathname.startsWith('/api/') || 
      url.pathname.includes('/auth/') ||
      url.pathname.includes('/firestore') ||
      url.pathname.includes('googleapis.com') ||
      url.pathname.includes('firebase')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // HTML files - NETWORK FIRST
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            console.log('[SW] Serving cached HTML');
            return cachedResponse;
          }
          return new Response('Offline - Please check your connection', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }
  
  // JS/CSS/Assets - CACHE FIRST, NETWORK FALLBACK
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Update cache in background
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      
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

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});