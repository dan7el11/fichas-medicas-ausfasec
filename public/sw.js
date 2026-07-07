// Service worker de la PWA. Estrategia conservadora:
//  - Navegaciones: red primero, con index.html cacheado como respaldo offline.
//  - Assets estáticos propios (js/css/imágenes/fuentes): caché primero.
//  - NUNCA intercepta peticiones a otros orígenes (Firebase, Google APIs):
//    los datos y fotos siguen yendo directo a Firestore/Storage, que ya
//    manejan su propia sincronización y cola offline.
const CACHE = 'fichas-medicas-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase y externos: no tocar

  // Navegación (abrir la app): red primero, respaldo offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('/index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE);
        const hit = await cache.match('/index.html');
        return hit ?? Response.error();
      }
    })());
    return;
  }

  // Assets estáticos: caché primero (los nombres de Vite van con hash)
  if (url.pathname.startsWith('/assets/') || /\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const fresh = await fetch(req);
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })());
  }
});
