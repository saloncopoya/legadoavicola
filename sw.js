const CACHE_NAME = 'legado-avicola-v5';
const BLOG_URL = 'https://legadoavicola.blogspot.com';

// Recursos esenciales para offline
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
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

// Fetch - Estrategia híbrida
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Para el blog principal - Network First con fallback a cache
    if (event.request.mode === 'navigate' || 
        url.hostname === 'legadoavicola.blogspot.com') {
        
        event.respondWith(
            fetch(event.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clone);
                });
                return response;
            }).catch(async () => {
                const cached = await caches.match(event.request);
                if (cached) return cached;
                
                // Si no hay cache del blog, devolver index.html
                return caches.match('/index.html');
            })
        );
    } 
    // Para recursos estáticos - Cache First
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
    // Para el resto - Network only
    else {
        event.respondWith(fetch(event.request));
    }
});

// Push Notifications
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
            data: { url: BLOG_URL },
            actions: [
                { action: 'open', title: 'Abrir portal' }
            ]
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || BLOG_URL;
    
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

// ==============================================
// 🟢 NUEVO CÓDIGO PARA EL WIDGET - PÉGALO AQUÍ ABAJO
// ==============================================

// MANEJO DE CLICKS EN NOTIFICACIONES (WIDGET)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const action = event.action;
    const baseUrl = 'https://legadoavicola.pages.dev';
    
    let url = baseUrl + '/';
    if (action === 'guias') url = baseUrl + '/?section=guias';
    if (action === 'sanidad') url = baseUrl + '/?section=sanidad';
    if (action === 'emergencia') url = baseUrl + '/?section=emergencia';
    
    // Notificar a la página
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Enviar mensaje a la página
                windowClients.forEach(client => {
                    client.postMessage({
                        type: 'NOTIFICATION_ACTION',
                        action: action
                    });
                });
                
                // Abrir ventana si es necesario
                return clients.openWindow(url);
            })
    );
});

// Crear notificación persistente por mensaje
self.addEventListener('message', (event) => {
    if (event.data?.type === 'CREATE_PERSISTENT_WIDGET') {
        self.registration.showNotification('🐔 Legado Avícola', {
            body: 'Acceso rápido al portal - Toca para abrir',
            icon: 'https://placehold.co/192x192/2E7D32/white?text=🐔',
            tag: 'legado-permanente',
            requireInteraction: true,
            renotify: false,
            silent: true,
            actions: [
                { action: 'guias', title: '📖 Guías' },
                { action: 'sanidad', title: '💊 Sanidad' },
                { action: 'alimentacion', title: '🍽️ Alimentación' },
                { action: 'emergencia', title: '🚨 Emergencia' }
            ]
        });
    }
});