const STATIC_CACHE_NAME = 'chinese-flashcards-static-v2';
const RUNTIME_CACHE_NAME = 'chinese-flashcards-runtime-v2';
const URLS_TO_CACHE = ['/manifest.json', '/logo.svg', '/offline.html'];

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/logo.svg' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/data/')
  );
}

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch(() => {
        // If offline page doesn't exist, that's okay
        return cache.addAll(URLS_TO_CACHE.filter(url => url !== '/offline.html'));
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== RUNTIME_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other non-http(s) protocols
  if (!event.request.url.startsWith('http')) {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html').catch(() => {
          return new Response('You are offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
    );
    return;
  }

  if (!isCacheableAsset(requestUrl)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      const networkFetch = fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type !== 'error'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(RUNTIME_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return networkResponse;
      });

      return response || networkFetch;
    }).catch(() => caches.match(event.request))
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
