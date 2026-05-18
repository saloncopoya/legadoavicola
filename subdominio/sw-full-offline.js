const CACHE_NAME = 'legado-offline-v2.0.33';
const DYNAMIC_CACHE = 'legado-dynamic-v2.0.33';

console.log('[SW] Archivo cargado correctamente');
console.log('[SW] Cache name:', CACHE_NAME);
console.log('[SW] Dynamic cache:', DYNAMIC_CACHE);

// TODAS las URLs a cachear (incluyendo Firebase)
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/offline.html',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/idb@8.0.0/build/umd.js',
    'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'
];

console.log('[SW] URLs a cachear:', urlsToCache.length);

// Instalar Service Worker
self.addEventListener('install', event => {
    console.log('[SW] Evento install - Service Worker instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                console.log('[SW] Cache abierto:', CACHE_NAME);
                for (const url of urlsToCache) {
                    try {
                        await cache.add(url);
                        console.log('[SW] Cacheado correctamente:', url);
                    } catch (err) {
                        console.warn('[SW] Falló al cachear:', url, err.message);
                    }
                }
                console.log('[SW] Install completado');
            })
    );
    self.skipWaiting();
    console.log('[SW] skipWaiting ejecutado');
});

// Activar Service Worker
self.addEventListener('activate', event => {
    console.log('[SW] Evento activate - Service Worker activando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            console.log('[SW] Caches existentes:', cacheNames);
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
                        console.log('[SW] Eliminando cache antiguo:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Activación completada');
        })
    );
    self.clients.claim();
    console.log('[SW] clients.claim ejecutado');
});

// Interceptar peticiones - Cache FIRST para TODO
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    console.log('[SW] Fetch interceptado:', event.request.method, url.pathname);

    // 🔥 CAMBIO 1: IGNORAR peticiones que NO sean GET
    if (event.request.method !== 'GET') {
        console.log('[SW] Método no-GET ignorado:', event.request.method);
        event.respondWith(fetch(event.request));
        return;
    }
    
    // 🔥 CAMBIO 2: IGNORAR peticiones a Firebase/Google cuando offline
    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('identitytoolkit') ||
        url.hostname.includes('accounts.google.com')) {
        console.log('[SW] Petición a Google API:', url.hostname);
        if (!navigator.onLine) {
            console.log('[SW] Offline - Google API bloqueada');
            event.respondWith(new Response('Offline', { status: 503 }));
            return;
        }
        console.log('[SW] Online - Pasando a red');
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Estrategia: Cache First, luego Network
    console.log('[SW] Buscando en cache:', url.pathname);
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('[SW] CACHE HIT:', url.pathname);
                    return response;
                }
                
                console.log('[SW] CACHE MISS - Yendo a red:', url.pathname);
                return fetch(event.request.clone())
                    .then(response => {
                        if (!response || response.status !== 200) {
                            console.log('[SW] Respuesta no cacheable:', response?.status);
                            return response;
                        }
                        
                        console.log('[SW] Cacheando respuesta:', url.pathname);
                        const responseToCache = response.clone();
                        caches.open(DYNAMIC_CACHE).then(cache => {
                            cache.put(event.request, responseToCache);
                            console.log('[SW] Respuesta cacheada en:', DYNAMIC_CACHE);
                        });
                        
                        return response;
                    })
                   .catch(error => {
                        console.log('[SW] Error de red:', error.message);
                        if (event.request.mode === 'navigate') {
                            console.log('[SW] Fallback a index.html');
                            return caches.match('/index.html').then(response => {
                                if (response) return response;
                                return caches.match('/offline.html');
                            });
                        }
                        
                        console.log('[SW] Fallback offline genérico');
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// Escuchar mensajes desde la app para sincronizar datos
self.addEventListener('message', event => {
    console.log('[SW] Mensaje recibido:', event.data);
    if (event.data.type === 'SYNC_DATA') {
        console.log('[SW] Tipo SYNC_DATA:', event.data);
        // Aquí puedes manejar sincronización de datos pendientes
    }
});

console.log('[SW] Service Worker completamente cargado y listo');
