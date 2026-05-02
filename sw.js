const CACHE_NAME = 'cotejo-offline-v4.0.6.9';
const urlsToCache = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    '/online.html',
    '/importar.html',
    '/sw.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Instalar Service Worker - CORREGIDO: cachea uno por uno sin fallar
self.addEventListener('install', event => {
    console.log('⚡ Service Worker instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('📦 Comenzando a cachear archivos...');
            for (const url of urlsToCache) {
                try {
                    await cache.add(url);
                    console.log(`✅ Cacheado: ${url}`);
                } catch (error) {
                    console.warn(`⚠️ No se pudo cachear (continuará igual): ${url}`, error);
                }
            }
            console.log('📦 Proceso de cache completado');
        })
    );
    self.skipWaiting();
});

// Activar Service Worker - IGUAL que tu código original
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

// Interceptar peticiones - MEJORADO para detectar navegación
self.addEventListener('fetch', event => {
    const request = event.request;
    
    // Para peticiones de navegación (páginas HTML)
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.match(request).then(cachedResponse => {
                if (cachedResponse) {
                    console.log(`📄 Servido desde cache: ${request.url}`);
                    return cachedResponse;
                }
                return fetch(request).catch(async () => {
                    console.log(`📄 Fallback a offline.html para: ${request.url}`);
                    const offlinePage = await caches.match('/offline.html');
                    return offlinePage || new Response('Página no disponible offline', {
                        status: 503,
                        statusText: 'Offline'
                    });
                });
            })
        );
        return;
    }
    
    // Para recursos estáticos (JS, CSS, imágenes, etc.)
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(request).catch(() => {
                // Para recursos externos, devolver respuesta vacía silenciosa
                if (request.url.includes('cdnjs') || request.url.includes('firebase')) {
                    return new Response('', { status: 200 });
                }
                return new Response('Recurso no disponible offline', {
                    status: 503,
                    statusText: 'Offline',
                    headers: new Headers({ 'Content-Type': 'text/plain' })
                });
            });
        })
    );
});
