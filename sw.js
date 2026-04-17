// sw.js - Service Worker para cache firch y modo offline
const CACHE_NAME = 'cotejo-offline-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/offline.html'
];

// Instalación: guardar archivos esenciales en caché
self.addEventListener('install', event => {
    console.log('[SW] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Archivos cacheados');
                return cache.addAll(urlsToCache);
            })
            .catch(err => console.error('[SW] Error en instalación:', err))
    );
    self.skipWaiting(); // Activar inmediatamente
});

// Activación: limpiar cachés antiguas
self.addEventListener('activate', event => {
    console.log('[SW] Activando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Eliminando caché antigua:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Tomar control inmediato
});

// Fetch: servir desde caché o red, con fallback a offline.html
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    
    // Solo manejar peticiones GET y de nuestro origen
    if (event.request.method !== 'GET') return;
    
    // Si es una petición a la raíz o a index.html, servir desde caché primero
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
        event.respondWith(
            caches.match('/index.html').then(response => {
                return response || fetch(event.request).catch(() => caches.match('/offline.html'));
            })
        );
        return;
    }
    
    // Para otros archivos estáticos: estrategia "stale-while-revalidate"
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // Actualizar caché con la nueva respuesta
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Si falla la red y no hay caché, mostrar offline.html
                if (cachedResponse) return cachedResponse;
                return caches.match('/offline.html');
            });
            
            return cachedResponse || fetchPromise;
        })
    );
});
