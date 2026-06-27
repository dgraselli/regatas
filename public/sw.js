/* Service worker para PWA.
   - HTML/navegación: network-first → siempre trae el shell fresco (con los hashes
     de chunks vigentes) cuando hay red; cae al caché solo offline. Esto evita el
     bug de servir un index.html viejo que pide chunks de _next que ya no existen.
   - Assets hasheados de _next (inmutables) e íconos: cache-first.
   - Pronóstico (Open-Meteo / INA): stale-while-revalidate (disponible offline). */

const CACHE = 'regatas-v3';
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
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
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
    // stale-while-revalidate
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Resto (assets hasheados de _next, inmutables, e íconos): cache-first con fallback a red.
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
