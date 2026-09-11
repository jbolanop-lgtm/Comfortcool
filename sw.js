// Service Worker de Comfort Cool
// Estrategia: "network-first" para el shell de la app (siempre intenta traer
// la versión más reciente desde el servidor) y solo usa el caché como
// respaldo cuando no hay conexión. Así evitamos que un usuario quede
// "atascado" viendo una versión vieja de la app mientras sigues actualizando
// el sistema.
//
// IMPORTANTE: este Service Worker NUNCA intercepta peticiones a Firebase
// (Auth/Firestore) ni a los CDN externos (Chart.js, SheetJS). Esas siempre
// van directo a la red para no romper el tiempo real ni el login.

const CACHE_NAME = 'comfort-cool-cache-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo gestionamos peticiones GET del mismo origen (el propio hosting).
  // Todo lo demás (Firebase, Google APIs, CDN de Chart.js/SheetJS, etc.)
  // se deja pasar sin tocar para no interferir con el tiempo real.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('./index.html');
        })
      )
  );
});
