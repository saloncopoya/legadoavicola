const CACHE_NAME = 'legado-offline-v2.0.11';
const DYNAMIC_CACHE = 'legado-dynamic-v2.0.11';

// TODAS las URLs a cachear (incluyendo Firebase)
const urlsToCache = [
    '/',
    '/index.html',
        '/manifest.json',
    '/offline.html',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
    'https://accounts.google.com/gsi/client',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
   'https://cdn.jsdelivr.net/npm/idb@8.0.0/build/umd.js',
    'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'
];

// Instalar Service Worker
self.addEventListener('install', event => {
    console.log('⚡ Service Worker FULL OFFLINE instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                for (const url of urlsToCache) {
                    try {
                        await cache.add(url);
                        console.log('✅ Cacheado:', url);
                    } catch (err) {
                        console.warn('⚠️ Falló:', url, err);
                    }
                }
            })
    );
    self.skipWaiting();
});

// Activar Service Worker
self.addEventListener('activate', event => {
    console.log('✅ Service Worker FULL OFFLINE activado');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
                        console.log('🧹 Eliminando cache antiguo:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Interceptar peticiones - Cache FIRST para TODO
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

      // 🔥 NUEVO: Para TODAS las rutas con ?section=, forzar respuesta con index.html
    if (url.pathname === '/' && url.searchParams.has('section')) {
        event.respondWith(
            caches.match('/index.html').then(response => {
                if (response) return response;
                return fetch(event.request);
            })
        );
        return;
    }
    
    // 🔥 CAMBIO 1: IGNORAR peticiones que NO sean GET
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // 🔥 CAMBIO 2: IGNORAR peticiones a Firebase/Google cuando offline
    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('identitytoolkit') ||
        url.hostname.includes('accounts.google.com')) {
        if (!navigator.onLine) {
            event.respondWith(new Response('Offline', { status: 503 }));
            return;
        }
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Estrategia: Cache First, luego Network
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('✅ [CACHE]', url.pathname);
                    return response;
                }
                
                console.log('🌐 [NETWORK]', url.pathname);
                return fetch(event.request.clone())
                    .then(response => {
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        
                        const responseToCache = response.clone();
                        caches.open(DYNAMIC_CACHE).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                        
                        return response;
                    })
                   .catch(() => {
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html').then(response => {
                                if (response) return response;
                                return caches.match('/offline.html');
                            });
                        }
                        
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    })
            })
    );
});

// Escuchar mensajes desde la app para sincronizar datos
self.addEventListener('message', event => {
    if (event.data.type === 'SYNC_DATA') {
        console.log('🔄 Recibido mensaje de sincronización:', event.data);
        // Aquí puedes manejar sincronización de datos pendientes
    }
});
