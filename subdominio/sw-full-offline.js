const CACHE_NAME = 'legado-offline-v3.1.29';
const DYNAMIC_CACHE = 'legado-dynamic-v3.1.29';


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


// Instalar Service Worker
self.addEventListener('install', event => {
    console.log('[SW] Evento install - Service Worker instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                for (const url of urlsToCache) {
                    try {
                        await cache.add(url);
                    } catch (err) {
                        console.warn('[SW] Falló al cachear:', url, err.message);
                    }
                }
                console.log('[SW] Install completado');
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
});

// Interceptar peticiones - Cache FIRST para TODO
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

        // 🔥 IGNORAR peticiones molestas (remove.video, etc)
    if (url.hostname.includes('remove.video') || 
        url.hostname.includes('cloudflare.com') ||
        url.hostname.includes('rum')) {
        return; // No hacer nada, dejar que el navegador la maneje
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
    console.log('[SW] Buscando en cache:', url.pathname);
    event.respondWith(
caches.match(url.pathname)
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
cache.put(url.pathname, responseToCache);
                        });
                        
                        return response;
                    })
                   .catch(error => {
                      if (event.request.mode === 'navigate') {
    console.log('[SW] Fallback a offline.html');
    // PRIMERO buscar offline.html
    return caches.match('/offline.html').then(response => {
        if (response) return response;
        // Si no hay offline.html, buscar index.html
        console.log('[SW] offline.html no encontrado, buscando index.html');
        return caches.match('/index.html');
    });
}
                        
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
    if (event.data.type === 'SYNC_DATA') {
        // Aquí puedes manejar sincronización de datos pendientes
    }
});

console.log('[SW] Service Worker completamente cargado y listo');









// ==============================================
// NOTIFICACIONES PUSH - SOLO UNA NOTIFICACIÓN (CON BOTONES)
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

const messaging = firebase.messaging();

// ==============================================
// 🚫 INTERCEPTAR PUSH - BLOQUEA NOTIFICACIÓN NATIVA DE FIREBASE
// ==============================================

// Esto se ejecuta PRIMERO y bloquea a Firebase
self.addEventListener('push', (event) => {
    console.log('[SW] 🚨 Push interceptado - Firebase NO lo procesará');
    
    event.waitUntil(
        (async () => {
            // Extraer datos del push
            let payload = {};
            if (event.data) {
                try {
                    payload = event.data.json();
                } catch(e) {
                    console.log('[SW] Error parseando payload:', e);
                    payload = { 
                        notification: { 
                            title: 'LEGADO AVICOLA', 
                            body: 'Nueva notificación' 
                        } 
                    };
                }
            }
            
            // Crear título y cuerpo
            const notificationTitle = payload.notification?.title || 'LEGADO AVICOLA';
            const notificationBody = payload.notification?.body || 'Notificación importante';
            const notificationImage = payload.notification?.image || self.location.origin + '/miniatura.jpg';
            const clickUrl = payload.fcmOptions?.link || '/';
            
            console.log('[SW] ✅ Mostrando NOTIFICACIÓN CON BOTONES (única)');
            
            // Tu notificación con botones
            const notificationOptions = {
                body: notificationBody,
                icon: self.location.origin + '/miniatura.jpg',
                badge: self.location.origin + '/favicon.ico',
                image: notificationImage,
                vibrate: [200, 100, 200],
                requireInteraction: true,
                priority: 'high',
                actions: [
                    { action: 'ver', title: '👁️ 1VER TORNEO' },
                    { action: 'compartir', title: '📤 2COMPARTIR' },
                    { action: 'recordar', title: '⏰ 3RECORDAR' }
                ],
                data: {
                    click_action: clickUrl,
                    url: clickUrl,
                    image: notificationImage
                },
                tag: 'legado_notificacion_unica',
                renotify: false
            };
            
            await self.registration.showNotification(notificationTitle, notificationOptions);
        })()
    );
});

// DESACTIVAR onBackgroundMessage (para que no intente mostrar otra)
messaging.onBackgroundMessage = () => {
    console.log('[SW] ⚠️ onBackgroundMessage ignorado - ya manejado por push event');
};

// Manejar clic en la notificación
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] 👆 Usuario hizo clic en la notificación');
    event.notification.close();
    
    let urlToOpen = '/';
    
    // Acciones de los botones
    if (event.action === 'ver') { 
        urlToOpen = '/?section=rooster'; 
        console.log('[SW] Abriendo torneos');
    } else if (event.action === 'compartir') { 
        urlToOpen = '/?section=share'; 
        console.log('[SW] Abriendo compartir');
    } else if (event.action === 'recordar') { 
        urlToOpen = '/?section=public'; 
        console.log('[SW] Abriendo inicio');
    } else { 
        urlToOpen = event.notification.data?.click_action || '/'; 
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Buscar ventana existente
                for (let client of windowClients) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Abrir nueva ventana
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

console.log('[SW] ✅ Service Worker configurado - Modo UNA SOLA NOTIFICACIÓN activado');
