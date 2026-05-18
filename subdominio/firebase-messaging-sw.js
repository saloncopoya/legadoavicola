// firebase-messaging-sw.js - COLOCAR EN LA RAIZ DEL SITIO
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

console.log('[FCM-SW] Service Worker de Firebase Messaging cargado');

// Configuración de Firebase (USAR LA MISMA QUE YA TIENES)
const firebaseConfig = {
    apiKey: "AIzaSyASox7mRak5V0py29htEVWCVeipGpA0yfs",
    authDomain: "galloslivebadge.firebaseapp.com",
    databaseURL: "https://galloslivebadge-default-rtdb.firebaseio.com",
    projectId: "galloslivebadge",
    messagingSenderId: "979482928760",
    appId: "1:979482928760:web:3ea879dc4ee1e020df6f8d"
};

// Inicializar Firebase en el SW
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Manejar notificaciones en segundo plano (cuando la app NO está abierta)
messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] Notificación en segundo plano recibida:', payload);
    
    const notificationTitle = payload.notification?.title || payload.data?.title || 'LEGADO AVICOLA';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Nueva notificación',
        icon: payload.notification?.icon || payload.data?.icon || '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        image: payload.notification?.image || payload.data?.image || null,
        tag: payload.data?.tag || 'legado_notification',
        data: {
            url: payload.data?.clickUrl || payload.notification?.clickUrl || '/',
            notificationId: payload.data?.notificationId || Date.now().toString()
        },
        requireInteraction: true,
        vibrate: [200, 100, 200],
        silent: false,
        actions: [
            { action: 'open', title: 'Ver ahora', icon: '/icons/open-icon.png' },
            { action: 'dismiss', title: 'Cerrar', icon: '/icons/close-icon.png' }
        ]
    };
    
    // Mostrar la notificación
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar click en la notificación
self.addEventListener('notificationclick', (event) => {
    console.log('[FCM-SW] Click en notificación:', event);
    
    event.notification.close();
    
    const clickUrl = event.notification.data?.url || '/';
    let finalUrl = clickUrl;
    
    // Asegurar que la URL sea absoluta
    if (finalUrl.startsWith('/')) {
        finalUrl = self.location.origin + finalUrl;
    }
    
    console.log('[FCM-SW] Redirigiendo a:', finalUrl);
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Si ya hay una ventana abierta, enfocarla y navegar
                for (let client of windowClients) {
                    if (client.url === finalUrl && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Si no hay ventana, abrir una nueva
                if (clients.openWindow) {
                    return clients.openWindow(finalUrl);
                }
            })
    );
});

console.log('[FCM-SW] Service Worker de notificaciones listo');
