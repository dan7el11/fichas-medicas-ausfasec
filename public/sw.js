// Service worker de la PWA. Estrategia conservadora:
//  - Navegaciones: red primero, con index.html cacheado como respaldo offline.
//  - Assets estáticos propios (js/css/imágenes/fuentes): caché primero.
//  - NUNCA intercepta peticiones a otros orígenes (Firebase, Google APIs):
//    los datos y fotos siguen yendo directo a Firestore/Storage, que ya
//    manejan su propia sincronización y cola offline.
const CACHE = 'fichas-medicas-v3';

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

  // SOLO http/https. Un `blob:` de los que genera la app (el PDF del visor, la
  // ficha en Excel) parece del mismo origen —`new URL('blob:https://sitio/id')`
  // devuelve `https://sitio` como origen— así que el filtro de abajo no lo
  // dejaba pasar. Al abrirlo en el iframe, en otra pestaña o al descargarlo
  // cuenta como navegación, y este worker intentaba `fetch()` de un blob que
  // no puede leer: el blob vive en el contexto de la página, no aquí. Fallaba,
  // caía en el respaldo offline y devolvía index.html. El visor recibía HTML
  // en lugar del PDF y la descarga del Excel no llegaba a empezar nunca.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

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
