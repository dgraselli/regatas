/* Service worker mínimo para PWA: cachea el app shell y aplica
   stale-while-revalidate a las llamadas de pronóstico (Open-Meteo / INA),
   de modo que el último pronóstico quede disponible offline. */

const CACHE = 'regatas-v1';
const SHELL = ['/', '/alertas', '/cruce', '/manifest.webmanifest', '/icons/icon.svg'];

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

  // app shell: cache-first con fallback a red
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
