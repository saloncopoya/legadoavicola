const CACHE_NAME = 'legadoavicola-v2';
const STATIC_CACHE = 'legadoavicola-static-v2';
const DYNAMIC_CACHE = 'legadoavicola-dynamic-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/_redirects',
  '/pages/public/home.html',
  '/pages/public/about.html',
  '/pages/public/contact.html',
  '/pages/public/gallery.html',
  '/pages/protected/torneo.html',
  '/pages/protected/cotejo.html',
  '/pages/protected/juez.html',
  '/pages/protected/perfil.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  // Estrategia: Cache First, luego Network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(() => {
            // Si es una página HTML, mostrar offline.html
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
