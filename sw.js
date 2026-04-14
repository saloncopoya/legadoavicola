const CACHE_NAME = 'legado-avicola-v6';
const BLOG_URL = 'https://calcutasysubastasjaviruiz.blogspot.com';

// Recursos esenciales para offline - TU INDEX ES LO PRINCIPAL
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',      // ← Este archivo contiene TODO (incluye offlineData)
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700',
    'https://fonts.gstatic.com/'
];

// Instalación
self.addEventListener('install', event => {
    console.log('[SW] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_CACHE_URLS).catch(err => {
                console.warn('Error cacheando recursos estáticos:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activación
self.addEventListener('activate', event => {
    console.log('[SW] Activando...');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - Estrategia: SIEMPRE devolver index.html para navegación
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Para navegación (cuando el usuario abre la app)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            // Intentar obtener de red primero (para actualizar)
            fetch(event.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clone);
                });
                return response;
            }).catch(async () => {
                // Si no hay red, devolver index.html desde caché
                const cachedIndex = await caches.match('/index.html');
                if (cachedIndex) {
                    console.log('[SW] Sirviendo index.html desde caché (offline)');
                    return cachedIndex;
                }
                // Fallback extremo (casi nunca ocurre)
                return new Response('Contenido offline no disponible', {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' }
                });
            })
        );
    }
    // Para el iframe del blog - Network First
    else if (url.hostname === 'calcutasysubastasjaviruiz.blogspot.com') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Si el blog falla, devolver un mensaje (no afecta tu app)
                return new Response('Blog no disponible offline', {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' }
                });
            })
        );
    }
    // Para recursos estáticos (CSS, JS, imágenes) - Cache First
    else if (event.request.destination === 'style' ||
             event.request.destination === 'script' ||
             event.request.destination === 'image') {
        event.respondWith(
            caches.match(event.request).then(cached => {
                return cached || fetch(event.request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                    return response;
                });
            })
        );
    }
    // Para el resto - Network First con fallback a caché
    else {
        event.respondWith(
            fetch(event.request).catch(async () => {
                const cached = await caches.match(event.request);
                return cached || new Response('Recurso no disponible', { status: 404 });
            })
        );
    }
});

// Push Notifications (mantener igual)
self.addEventListener('push', event => {
    let data = {
        title: '🐔 Legado Avícola',
        body: '¡Nuevo contenido disponible en el portal!',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png'
    };
    
    if (event.data) {
        try {
            const parsed = event.data.json();
            data = { ...data, ...parsed };
        } catch(e) {
            data.body = event.data.text();
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            vibrate: [200, 100, 200],
            data: { url: '/' },
            actions: [
                { action: 'open', title: 'Abrir portal' }
            ]
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientsArr => {
            for (const client of clientsArr) {
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});

// Mensajes desde la página
self.addEventListener('message', event => {
    if (event.data?.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(
            event.data.title || 'Legado Avícola',
            {
                body: event.data.body || 'Mensaje del portal',
                icon: event.data.icon || '/icons/icon-192.png'
            }
        );
    }
});
