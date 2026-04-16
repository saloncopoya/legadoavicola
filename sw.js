// sw.js - Service Worker Avanzado
const CACHE_NAME = 'galloslive-v1.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/css/main.css',
  '/js/app.js',
  '/js/db.js',
  '/js/sync.js',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// URLs de API para caché
const API_URLS = [
  '/api/torneos',
  '/api/ranking',
  '/api/resultados'
];

// Instalación: cachear assets estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activación: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia: Cache First then Network para estáticos
async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return caches.match('/offline.html');
  }
}

// Estrategia: Network First con fallback a cache para APIs
async function networkFirstWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }
    throw new Error('Network response not ok');
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline mode', data: [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Interceptar fetch
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // API requests: Network First
  if (API_URLS.some(apiUrl => url.pathname.startsWith(apiUrl))) {
    event.respondWith(networkFirstWithCacheFallback(event.request));
  } 
  // Static assets: Cache First
  else if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(cacheFirstThenNetwork(event.request));
  }
  // Imágenes: Cache First con expiración
  else if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
    event.respondWith(cacheFirstThenNetwork(event.request));
  }
  // Resto: Network First
  else {
    event.respondWith(networkFirstWithCacheFallback(event.request));
  }
});

// Background Sync para operaciones pendientes
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-operations') {
    event.waitUntil(syncPendingOperations());
  }
});

async function syncPendingOperations() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_TRIGGERED' });
  });
}

// Push Notifications
self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'GallosLive', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Periodic Sync para actualizar datos en segundo plano
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-data') {
    event.waitUntil(updateBackgroundData());
  }
});

async function updateBackgroundData() {
  const cache = await caches.open(CACHE_NAME);
  for (const apiUrl of API_URLS) {
    try {
      const response = await fetch(apiUrl);
      if (response.ok) {
        cache.put(apiUrl, response.clone());
      }
    } catch (error) {
      console.log('Background sync failed:', error);
    }
  }
}
