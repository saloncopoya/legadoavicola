// ==============================================
// SERVICE WORKER PARA LA APP /1/
// SCOPE: /1/
// ==============================================

const CACHE_NAME = 'app1-offline-v0.0.847';
const DYNAMIC_CACHE = 'app1-dynamic-v0.0.317';

// URLs específicas para la carpeta /1/
const urlsToCache = [
    '/1/',
    '/1/index.html',
    '/1/manifest.json',
    '/offline.html',
    // Recursos compartidos (ruta absoluta desde raíz)
    '/icon-192.png',
    '/icon-512.png',
    '/favicon.ico',
    '/miniatura.jpg',
    // Firebase y librerías
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/idb@8.0.0/build/umd.js',
    'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'
];

// Instalar Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                for (const url of urlsToCache) {
                    try {
                        await cache.add(url);
                    } catch (err) {
                        console.log('[SW /1/] Error cacheando:', url, err);
                    }
                }
            })
    );
    self.skipWaiting();
});

// Activar Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            console.log('[SW /1/] Activado y limpiado');
        })
    );
    self.clients.claim();
});

// Interceptar peticiones - Cache FIRST
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // IGNORAR peticiones molestas
    if (url.hostname.includes('remove.video') || 
        url.hostname.includes('cloudflare.com') ||
        url.hostname.includes('rum')) {
        return;
    }
    
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // IGNORAR peticiones a Firebase/Google cuando offline
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
                    return response;
                }
                
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
                    .catch(error => {
                        if (event.request.mode === 'navigate') {
                            return caches.match('/offline.html').then(response => {
                                if (response) return response;
                                return caches.match('/1/index.html');
                            });
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Escuchar mensajes
self.addEventListener('message', event => {
    if (event.data.type === 'SYNC_DATA') {
        // Sincronización de datos pendientes
    }
});

console.log('[SW /1/] Service Worker cargado - Scope: /1/');

// ==============================================
// NOTIFICACIONES PUSH
// ==============================================
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyASox7mRak5V0py29htEVWCVeipGpA0yfs",
    authDomain: "galloslivebadge.firebaseapp.com",
    databaseURL: "https://galloslivebadge-default-rtdb.firebaseio.com",
    projectId: "galloslivebadge",
    messagingSenderId: "979482928760",
    appId: "1:979482928760:web:3ea879dc4ee1e020df6f8d"
});

self.addEventListener('push', (event) => {
    event.waitUntil(
        (async () => {
            let payload = {};
            if (event.data) {
                try {
                    payload = event.data.json();
                } catch(e) {}
            }

            const customData = payload.data || {};
            
            // Construir botones dinámicos
            const botones = [];
            for (let i = 1; i <= 3; i++) {
                const nombreBoton = customData[`letra${i}`];
                const urlBoton = customData[`boton${i}`];
                if (nombreBoton && urlBoton) {
                    botones.push({
                        action: `boton_${i}`,
                        title: nombreBoton
                    });
                }
            }

            const actions = botones.length > 0 ? botones : [
                { action: 'ver', title: '👁️ VER TORNEO' },
                { action: 'compartir', title: '📤 COMPARTIR' },
                { action: 'recordar', title: '⏰ RECORDAR' }
            ];

            const urlsBotones = {};
            for (let i = 1; i <= 3; i++) {
                const urlBoton = customData[`boton${i}`];
                if (urlBoton) {
                    urlsBotones[`boton_${i}`] = urlBoton;
                }
            }
            
            const notificationTitle = payload.notification?.title || 'LEGADO AVICOLA';
            const notificationOptions = {
                body: payload.notification?.body || 'Notificación importante',
                icon: customData['icono'] || payload.notification?.image || self.location.origin + '/miniatura.jpg',
                badge: self.location.origin + '/favicon.ico',
                image: payload.notification?.image || self.location.origin + '/miniatura.jpg',
                vibrate: [200, 100, 200],
                requireInteraction: true,
                priority: 'high',
                silent: false,
                renotify: true,
                tag: 'app1_notificacion_' + Date.now(),
                actions: actions,
                data: {
                    urls: urlsBotones,
                    url_por_defecto: customData.url || '/1/'
                }
            };
            
            await self.registration.showNotification(notificationTitle, notificationOptions);
        })()
    );
});

// Manejar clic en botones de notificación
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const urlsGuardadas = event.notification.data?.urls || {};
    const urlPorDefecto = event.notification.data?.url_por_defecto || '/1/';
    let urlToOpen = urlPorDefecto;

    if (event.action === 'boton_1' && urlsGuardadas['boton_1']) {
        urlToOpen = urlsGuardadas['boton_1'];
    } else if (event.action === 'boton_2' && urlsGuardadas['boton_2']) {
        urlToOpen = urlsGuardadas['boton_2'];
    } else if (event.action === 'boton_3' && urlsGuardadas['boton_3']) {
        urlToOpen = urlsGuardadas['boton_3'];
    } else if (event.action === 'ver') {
        urlToOpen = '/1/?section=rooster';
    } else if (event.action === 'compartir') {
        urlToOpen = '/1/?section=share';
    } else if (event.action === 'recordar') {
        urlToOpen = '/1/?section=public';
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                for (let client of windowClients) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
