/**
 * Cloudflare Worker: proxy de SOLO LECTURA para METAR (aviationweather.gov / NOAA).
 *
 * La app es estática (GitHub Pages, detrás de Cloudflare) y hace fetch 100% del
 * cliente; la API de METAR no trae header CORS, así que el navegador no puede
 * llamarla directo. Este Worker corre a demanda en el borde, hace la llamada
 * server-to-server (sin CORS), cachea (~60 s) y responde con CORS. Es stateless:
 * no guarda nada ni maneja datos de usuario.
 *
 * Se engancha por Workers Route a `regatas.com.ar/api/metar*` (ver wrangler.toml),
 * así el navegador lo llama SAME-ORIGIN. Deploy: `npx wrangler deploy` (ver README).
 */
const UPSTREAM = 'https://aviationweather.gov/api/data/metar';
const ALLOW_ORIGIN = 'https://regatas.com.ar';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    if (request.method !== 'GET') return json({ error: 'method' }, 405);

    const url = new URL(request.url);
    // Sanitizar los ids: solo códigos ICAO (letras/números, 3–4), separados por coma.
    // Evita que el Worker sea un proxy abierto: solo sirve para pedir METAR.
    const ids = (url.searchParams.get('ids') ?? '')
      .toUpperCase()
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[A-Z0-9]{3,4}$/.test(s))
      .slice(0, 8);
    if (!ids.length) return json({ error: 'ids' }, 400);
    const hours = Math.min(24, Math.max(1, Number(url.searchParams.get('hours')) || 2));

    const upstream = `${UPSTREAM}?ids=${ids.join(',')}&format=json&hours=${hours}`;
    let res;
    try {
      res = await fetch(upstream, { cf: { cacheTtl: 60, cacheEverything: true } });
    } catch {
      return json({ error: 'fetch' }, 502);
    }
    if (!res.ok) return json({ error: 'upstream', status: res.status }, 502);

    return new Response(res.body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60',
        ...cors(),
      },
    });
  },
};

function cors() {
  return {
    'access-control-allow-origin': ALLOW_ORIGIN,
    'access-control-allow-methods': 'GET, OPTIONS',
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...cors() },
  });
}
