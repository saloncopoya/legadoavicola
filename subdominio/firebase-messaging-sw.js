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

messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'LEGADO AVICOLA';
    const notificationOptions = {
        body: payload.notification?.body || 'Notificación importante',
        icon: '/miniatura.jpg',
        badge: '/favicon.ico',
        tag: 'legado_notificacion_' + Date.now(),
        requireInteraction: true
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});
