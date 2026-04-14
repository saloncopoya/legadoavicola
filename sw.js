const CACHE_NAME = 'mi-app-v1';

// IMPORTANTE: Lista CADA archivo que quieras offline
const ARCHIVOS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/pages/pagina1.html',
  '/pages/pagina2.html'
];

self.addEventListener('install', event => {
  console.log('Instalando SW...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cacheando archivos...');
        return cache.addAll(ARCHIVOS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('Activando SW...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('Eliminando cache vieja:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(respuesta => {
        if (respuesta) {
          console.log('✅ Desde cache:', event.request.url);
          return respuesta;
        }
        console.log('🌐 Desde red:', event.request.url);
        return fetch(event.request);
      })
  );
});
