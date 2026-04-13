// Nombre de la cache - cámbialo cuando actualices la app
const CACHE_NAME = 'legadoavicola-v3';
const OFFLINE_URL = '/index.html';

// Archivos a cachear durante la instalación (CRÍTICOS para offline)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
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

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos iniciales');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[SW] Instalación completa');
        return self.skipWaiting(); // Activar inmediatamente
      })
  );
});

// Activación - limpiar caches viejos
self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Eliminando cache vieja:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activación completa, tomando control');
      return self.clients.claim(); // Tomar control inmediato
    })
  );
});

// Estrategia: Cache First, luego Network (para offline)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Ignorar peticiones a Firebase/Google (solo si quieres)
  if (url.hostname.includes('firebase') || url.hostname.includes('google')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Si está en cache, devolverlo
        if (cachedResponse) {
          console.log('[SW] Cache hit:', event.request.url);
          return cachedResponse;
        }
        
        // Si no está en cache, intentar red
        return fetch(event.request)
          .then(networkResponse => {
            // Verificar respuesta válida
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Clonar y guardar en cache
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('[SW] Cacheado:', event.request.url);
              });
            
            return networkResponse;
          })
          .catch(error => {
            console.log('[SW] Falló la red, usando offline fallback:', error);
            
            // Si es una petición de navegación (HTML), devolver index.html
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // Para otros recursos, devolver error
            return new Response('Contenido no disponible offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Sincronización en segundo plano (para cuando vuelva internet)
self.addEventListener('sync', event => {
  console.log('[SW] Sync event:', event.tag);
  if (event.tag === 'sync-pending-operations') {
    event.waitUntil(syncPendingOperations());
  }
});

async function syncPendingOperations() {
  // Aquí puedes implementar sincronización con Firebase cuando vuelva internet
  console.log('[SW] Sincronizando operaciones pendientes...');
  
  // Notificar a los clientes (la página) que hay internet
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'ONLINE_SYNC',
      message: 'Conexión restaurada, sincronizando...'
    });
  });
}

// Manejar mensajes desde la página
self.addEventListener('message', event => {
  console.log('[SW] Mensaje recibido:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_NEW_PAGE') {
    const { url, html } = event.data;
    caches.open(CACHE_NAME).then(cache => {
      cache.put(url, new Response(html));
    });
  }
});
