const CACHE_NAME = 'galloslive-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html'
];

// Instalar Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activar Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Eliminando cache antiguo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia: Stale While Revalidate
self.addEventListener('fetch', event => {
  // No cachear llamadas a Firebase
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firebaseapp.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // Actualizar cache con la respuesta de red
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Si falla la red, retornar respuesta cacheada
            if (cachedResponse) {
              return cachedResponse;
            }
            // Si es una navegación y no hay cache, mostrar offline.html
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
          });
        
        // Retornar respuesta cacheada o ir a la red
        return cachedResponse || fetchPromise;
      })
  );
});

// Sincronización en segundo plano (Background Sync)
self.addEventListener('sync', event => {
  console.log('Background Sync activado:', event.tag);
  if (event.tag === 'sync-torneos') {
    event.waitUntil(syncTorneos());
  }
});

async function syncTorneos() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_TRIGGERED',
      message: 'Sincronización en segundo plano iniciada'
    });
  });
}
