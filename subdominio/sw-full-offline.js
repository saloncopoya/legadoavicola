// ==============================================
// SERVICE WORKER FULL OFFLINE - CON DEPURADOR
// VERSIÓN: 3.0.1 (DEBUG)
// ==============================================

const CACHE_NAME = 'legado-avicola-v3.0.1';
const DYNAMIC_CACHE = 'legado-dynamic-v3.0.1';

// ==============================================
// DEPURADOR DEL SERVICE WORKER
// ==============================================
const SW_DEBUG = true;

function swLog(message, type = 'info', data = null) {
    if (!SW_DEBUG) return;
    
    const prefix = '🔧 [SW-DEBUG]';
    switch(type) {
        case 'success':
            console.log(`${prefix} ✅ ${message}`, data || '');
            break;
        case 'error':
            console.error(`${prefix} ❌ ${message}`, data || '');
            break;
        case 'warn':
            console.warn(`${prefix} ⚠️ ${message}`, data || '');
            break;
        case 'network':
            console.log(`${prefix} 🌐 ${message}`, data || '');
            break;
        case 'cache':
            console.log(`${prefix} 📀 ${message}`, data || '');
            break;
        default:
            console.log(`${prefix} ${message}`, data || '');
    }
}

// URLs a cachear
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
    'https://accounts.google.com/gsi/client',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/idb@8.0.0/build/umd.js',
    'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'
];

// ==============================================
// EVENTO: INSTALL
// ==============================================
self.addEventListener('install', event => {
    swLog('📦 EVENTO INSTALL - Iniciando...', 'info');
    
    event.waitUntil(
        (async () => {
            try {
                swLog('Abriendo cache...', 'info');
                const cache = await caches.open(CACHE_NAME);
                
                swLog(`Intentando cachear ${urlsToCache.length} recursos...`, 'info');
                
                let successCount = 0;
                let failCount = 0;
                
                for (const url of urlsToCache) {
                    try {
                        swLog(`Cacheando: ${url}`, 'network');
                        const response = await fetch(url, { cache: 'reload' });
                        
                        if (response && response.ok) {
                            await cache.put(url, response);
                            swLog(`✅ Cacheado: ${url}`, 'success');
                            successCount++;
                        } else {
                            swLog(`⚠️ Respuesta no OK para: ${url}`, 'warn');
                            failCount++;
                        }
                    } catch (error) {
                        swLog(`❌ Falló cache: ${url} - ${error.message}`, 'error');
                        failCount++;
                    }
                }
                
                swLog(`📊 RESUMEN INSTALL: ✅ ${successCount} exitosos, ❌ ${failCount} fallidos`, 
                      failCount === 0 ? 'success' : 'warn');
                
            } catch (error) {
                swLog(`ERROR CRÍTICO en install: ${error.message}`, 'error');
            }
        })()
    );
    
    swLog('Activando skipWaiting()...', 'info');
    self.skipWaiting();
});

// ==============================================
// EVENTO: ACTIVATE
// ==============================================
self.addEventListener('activate', event => {
    swLog('⚡ EVENTO ACTIVATE - Iniciando...', 'info');
    
    event.waitUntil(
        (async () => {
            try {
                swLog('Limpiando caches antiguos...', 'info');
                const cacheNames = await caches.keys();
                swLog(`Caches encontradas: ${cacheNames.join(', ')}`, 'info');
                
                let deletedCount = 0;
                for (const cache of cacheNames) {
                    if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
                        swLog(`🗑️ Eliminando cache antigua: ${cache}`, 'warn');
                        await caches.delete(cache);
                        deletedCount++;
                    }
                }
                
                swLog(`✅ Eliminadas ${deletedCount} caches antiguas`, 'success');
                
                // Tomar control de todas las páginas
                swLog('Tomando control de clientes...', 'info');
                await self.clients.claim();
                swLog('✅ Service Worker activo y controlando todas las páginas', 'success');
                
                // Notificar a la página
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({ 
                        type: 'SW_ACTIVATED', 
                        timestamp: Date.now(),
                        cacheName: CACHE_NAME 
                    });
                });
                
            } catch (error) {
                swLog(`ERROR en activate: ${error.message}`, 'error');
            }
        })()
    );
});

// ==============================================
// EVENTO: FETCH (INTERCEPTAR PETICIONES)
// ==============================================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const requestUrl = url.pathname + url.search;
    
    // Solo GET
    if (event.request.method !== 'GET') {
        swLog(`Ignorando método ${event.request.method}: ${requestUrl}`, 'warn');
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Firebase/Google APIs - solo online
    if (url.hostname.includes('firebase') || 
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('identitytoolkit') ||
        url.hostname.includes('accounts.google.com')) {
        
        if (!navigator.onLine) {
            swLog(`📴 OFFLINE - Firebase API bloqueada: ${requestUrl}`, 'warn');
            event.respondWith(new Response(JSON.stringify({ offline: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));
            return;
        }
        
        swLog(`🌐 ONLINE - Firebase API: ${requestUrl}`, 'network');
        event.respondWith(fetch(event.request));
        return;
    }
    
    // ESTRATEGIA: CACHE FIRST
    event.respondWith(
        (async () => {
            try {
                // 1. Buscar en cache
                swLog(`🔍 Buscando en cache: ${requestUrl}`, 'cache');
                const cachedResponse = await caches.match(event.request);
                
                if (cachedResponse) {
                    swLog(`✅ CACHE HIT: ${requestUrl}`, 'success');
                    return cachedResponse;
                }
                
                // 2. Ir a la red
                swLog(`🌐 CACHE MISS - Yendo a red: ${requestUrl}`, 'network');
                const networkResponse = await fetch(event.request);
                
                // 3. Cachear respuesta exitosa
                if (networkResponse && networkResponse.status === 200) {
                    swLog(`💾 Cacheando respuesta: ${requestUrl}`, 'cache');
                    const cache = await caches.open(DYNAMIC_CACHE);
                    cache.put(event.request, networkResponse.clone());
                }
                
                return networkResponse;
                
            } catch (error) {
                swLog(`❌ ERROR FETCH: ${requestUrl} - ${error.message}`, 'error');
                
                // Fallback para navegación
                if (event.request.mode === 'navigate') {
                    swLog(`📄 Fallback a index.html para: ${requestUrl}`, 'warn');
                    const cachedIndex = await caches.match('/index.html');
                    if (cachedIndex) return cachedIndex;
                }
                
                // Fallback genérico
                return new Response('📴 Modo offline - No hay conexión', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }
        })()
    );
});

// ==============================================
// EVENTO: MESSAGE (Recibir mensajes de la página)
// ==============================================
self.addEventListener('message', event => {
    swLog(`📨 Mensaje recibido de la página:`, 'info', event.data);
    
    switch (event.data?.type) {
        case 'SKIP_WAITING':
            swLog('🔄 Skip waiting solicitado', 'info');
            self.skipWaiting();
            break;
            
        case 'GET_STATUS':
            swLog('📊 Enviando estado del SW', 'info');
            event.source.postMessage({
                type: 'SW_STATUS',
                cacheName: CACHE_NAME,
                dynamicCache: DYNAMIC_CACHE,
                isActive: true
            });
            break;
            
        case 'CLEAR_CACHE':
            swLog('🧹 Limpiando cache dinámica...', 'warn');
            (async () => {
                await caches.delete(DYNAMIC_CACHE);
                swLog('✅ Cache dinámica limpiada', 'success');
                event.source.postMessage({ type: 'CACHE_CLEARED' });
            })();
            break;
            
        default:
            swLog(`Mensaje sin tipo:`, 'info', event.data);
    }
});

// ==============================================
// EVENTO: SYNC (Sincronización en segundo plano)
// ==============================================
self.addEventListener('sync', event => {
    swLog(`🔄 EVENTO SYNC: ${event.tag}`, 'info');
    
    if (event.tag === 'sync-offline-data') {
        event.waitUntil(
            (async () => {
                swLog('Ejecutando sincronización de datos offline...', 'info');
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({ type: 'BACKGROUND_SYNC', timestamp: Date.now() });
                });
                swLog('✅ Sincronización completada', 'success');
            })()
        );
    }
});

// ==============================================
// EVENTO: PUSH (Notificaciones)
// ==============================================
self.addEventListener('push', event => {
    swLog(`📬 EVENTO PUSH recibido`, 'info');
    
    if (event.data) {
        try {
            const data = event.data.json();
            swLog('Datos push:', 'info', data);
            
            event.waitUntil(
                self.registration.showNotification(data.title || 'Legado Avícola', {
                    body: data.body || 'Nueva actualización',
                    icon: '/icon-192.png',
                    badge: '/badge.png'
                })
            );
        } catch (error) {
            swLog(`Error procesando push: ${error.message}`, 'error');
        }
    }
});

// ==============================================
// FUNCIÓN DE REPORTE DE ESTADO
// ==============================================
async function reportStatus() {
    swLog('='.repeat(50), 'info');
    swLog('📊 REPORTE DE ESTADO DEL SW', 'info');
    swLog('='.repeat(50), 'info');
    swLog(`Cache name: ${CACHE_NAME}`, 'info');
    swLog(`Dynamic cache: ${DYNAMIC_CACHE}`, 'info');
    
    try {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        swLog(`Recursos en cache estática: ${keys.length}`, 'info');
        
        const dynamicCache = await caches.open(DYNAMIC_CACHE);
        const dynamicKeys = await dynamicCache.keys();
        swLog(`Recursos en cache dinámica: ${dynamicKeys.length}`, 'info');
    } catch (error) {
        swLog(`Error leyendo caches: ${error.message}`, 'error');
    }
    
    swLog('='.repeat(50), 'info');
}

// Reportar estado al activarse
setTimeout(() => reportStatus(), 1000);

swLog('🚀 Service Worker cargado y listo para usar', 'success');
