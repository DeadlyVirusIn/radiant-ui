// PTCGP WebUI Service Worker
// v17 (2026-04-28): bumped from v16 to evict stale browser HTTP caches
//                   carrying wrong B3 godpack /api/cards/*/image responses.
//                   Image URLs also bumped from ?v=4 to ?v=5 in all client
//                   call sites to force a full re-fetch.
const CACHE_NAME = 'ptcgp-webui-v17';
const STATIC_CACHE = 'ptcgp-static-v17';
const API_CACHE = 'ptcgp-api-v17';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
];

// API routes to cache with network-first strategy
const API_ROUTES = [
  '/api/collection',
  '/api/cards',
  '/api/accounts',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Auth endpoints — NEVER cache or intercept. The SW must never serve a
  // stale 200 for /api/auth/me from a prior session; auth state has to be
  // live. Returning without calling respondWith hands the request back to
  // the browser to perform the actual network fetch directly.
  if (url.pathname.startsWith('/api/auth/')) {
    return;
  }

  // API image requests — network only, don't cache (large binary files).
  // Wave 1.1 fix: wrap in catch so a network error can't propagate as an
  // unhandled rejection to respondWith (which would surface as "FetchEvent
  // for ... resulted in a network error response" in the browser).
  if (url.pathname.startsWith('/api/') && url.pathname.includes('/image')) {
    event.respondWith(
      fetch(request).catch(() => new Response('', { status: 503, statusText: 'Offline' }))
    );
    return;
  }

  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets - cache first, fallback to network
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages - network first for fresh content
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Default - stale while revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

// Cache first strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, no cache available:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, checking cache:', error);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale while revalidate strategy
// Wave 1.1 fix: the fetch catch used to return null, which meant
// event.respondWith received a Promise<null> when both the cache and the
// network missed. Browsers surface this as "Failed to convert value to
// 'Response'". The catch now returns a real Response so the chain is
// always Response | Promise<Response>.
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => new Response('Offline', { status: 503 }));

  // cached is either a Response or undefined. If undefined, we fall
  // through to fetchPromise which is guaranteed to resolve to a Response.
  return cached || fetchPromise;
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/i.test(pathname);
}

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PTCGP WebUI', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-collection') {
    event.waitUntil(syncCollection());
  }
});

async function syncCollection() {
  // Sync any pending collection changes when back online
  const cache = await caches.open('ptcgp-pending');
  const requests = await cache.keys();

  for (const request of requests) {
    try {
      const response = await cache.match(request);
      const data = await response.json();
      await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await cache.delete(request);
    } catch (error) {
      console.log('[SW] Sync failed:', error);
    }
  }
}

console.log('[SW] Service worker loaded');
