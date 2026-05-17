// sw-full-offline.js
const CACHE_NAME = 'legado-offline-v2.0.20';
const DYNAMIC_CACHE = 'legado-dynamic-v2.0.20';

// TODAS las URLs que quieres que funcionen OFFLINE
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
    'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
    'https://accounts.google.com/gsi/client'
];

// INSTALAR - Cachear todo inmediatamente
self.addEventListener('install', event => {
    console.log('⚡ SW: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            for (const url of urlsToCache) {
                try {
                    await cache.add(url);
                    console.log('✅ Cacheado:', url);
                } catch (err) {
                    console.warn('⚠️ Falló:', url);
                }
            }
        })
    );
    self.skipWaiting();
});

// ACTIVAR - Limpiar caches viejos
self.addEventListener('activate', event => {
    console.log('✅ SW: Activado');
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
                    console.log('🗑️ Eliminando:', key);
                    return caches.delete(key);
                }
            })
        ))
    );
    self.clients.claim();
});

// FETCH - ESTRATEGIA: CACHE FIRST (OFFLINE FIRST)
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Ignorar métodos no-GET
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Ignorar Firebase/Google cuando offline
    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('gstatic.com')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // ⭐ ESTRATEGIA PRINCIPAL: Cache First, luego Network
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                console.log('📀 [OFFLINE]', url.pathname);
                return cachedResponse;
            }
            
            console.log('🌐 [NETWORK]', url.pathname);
            return fetch(event.request.clone()).then(response => {
                if (!response || response.status !== 200) return response;
                
                const responseToCache = response.clone();
                caches.open(DYNAMIC_CACHE).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            }).catch(() => {
                // Si es navegación y falla, mostrar index.html
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});
