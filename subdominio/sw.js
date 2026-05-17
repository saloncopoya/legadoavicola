const CACHE_NAME = 'legado-avicola-v1.0.0';

// URLs específicas para cachear (las 4 pantallas públicas + recursos)
const urlsToCache = [
    '/',
    '/index.html',
    '/offline.html',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
    'https://accounts.google.com/gsi/client',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
];

// Instalar Service Worker
self.addEventListener('install', event => {
    console.log('⚡ Service Worker instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                console.log('📦 Cacheando archivos base');
                for (const url of urlsToCache) {
                    try {
                        await cache.add(url);
                        console.log('✅ Cacheado:', url);
                    } catch (err) {
                        console.warn('⚠️ No se pudo cachear:', url, err);
                    }
                }
            })
    );
    self.skipWaiting();
});

// Activar Service Worker
self.addEventListener('activate', event => {
    console.log('✅ Service Worker activado');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('🧹 Eliminando cache antiguo:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Interceptar peticiones
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Si es una navegación (cambio de página) o un recurso necesario
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('✅ Desde CACHÉ:', url.pathname);
                    return response;
                }
                
                console.log('🌐 Desde INTERNET:', url.pathname);
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then(response => {
                    if (!response || response.status !== 200) {
                        return response;
                    }
                    
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                        console.log('💾 Guardado en CACHÉ:', url.pathname);
                    });
                    
                    return response;
                }).catch(() => {
                    // Si es una navegación y está offline, mostrar la pantalla pública
                    if (event.request.mode === 'navigate') {
                        console.log('📴 Offline - Sirviendo index.html desde caché');
                        return caches.match('/index.html');
                    }
                    return new Response('Recurso no disponible offline', {
                        status: 503,
                        statusText: 'Offline'
                    });
                });
            })
    );
});
