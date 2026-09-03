/* Service worker para PWA.
   - HTML/navegación: network-first → siempre trae el shell fresco (con los hashes
     de chunks vigentes) cuando hay red; cae al caché solo offline. Esto evita el
     bug de servir un index.html viejo que pide chunks de _next que ya no existen.
   - Assets hasheados de _next (inmutables) e íconos: cache-first.
   - Pronóstico (Open-Meteo / INA): network-first → dato fresco cuando hay red; el
     caché queda solo como respaldo offline. (Antes era stale-while-revalidate, pero
     podía servir una respuesta de días atrás: React Query la tomaba como fresca y
     el filtro de días pasados del panel descartaba todo → panel en blanco.) */

// CI reemplaza 77ec0bfbea9b57fb4d0b40f56747bb19ce0e3fc3 con el SHA del commit (ver deploy.yml y
// pr-preview.yml) después de `next build`. Sin esto el service worker es
// byte-idéntico entre deploys que no tocan este archivo, así que el navegador
// nunca detecta que hay una versión nueva para instalar. No se usa en ninguna
// lógica de abajo: solo existe para que el contenido del archivo cambie.
const BUILD = '77ec0bfbea9b57fb4d0b40f56747bb19ce0e3fc3';

const CACHE = 'regatas-v4';
// Rutas relativas al scope del SW: en dev resuelven a la raíz; en GitHub Pages, a /regatas/.
const SHELL = ['./', './mareas/', './cruce/', './perfil/', './manifest.webmanifest', './icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

function isApi(url) {
  return /open-meteo\.com|ina\.gob\.ar/.test(url);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navegación / HTML: network-first (no servir un shell viejo con chunks caducos).
  // cache: 'no-store' salta la caché HTTP del navegador (no solo la del SW):
  // sin esto, un index.html con un Cache-Control corto podía volver a
  // servirse "fresco" desde ahí aunque ya hubiera una versión nueva publicada.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  if (isApi(request.url)) {
    // network-first: dato fresco siempre que haya red; caché solo offline.
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const res = await fetch(request);
          cache.put(request, res.clone());
          return res;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw new Error('offline y sin caché para ' + request.url);
        }
      }),
    );
    return;
  }

  // Resto (assets hasheados de _next, inmutables, e íconos): cache-first con fallback a red.
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
