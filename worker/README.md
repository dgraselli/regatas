# Worker METAR (proxy de visibilidad observada)

Proxy serverless de solo lectura para METAR (aviationweather.gov). Resuelve que la
app estática (GitHub Pages, detrás de Cloudflare) no puede llamar a la API por falta
de CORS. Ver el porqué en `metar.js` y en `docs/PLAN.md`.

## Qué hace

- Vive en su propio subdominio **`api.regatas.com.ar`** (Worker Custom Domain).
- Escucha en `api.regatas.com.ar/metar?ids=SABE&hours=2`.
- Sanitiza los `ids` (solo ICAO), llama a aviationweather server-to-server, cachea
  ~60 s y responde con CORS (`Access-Control-Allow-Origin: https://regatas.com.ar`).
  Sin estado ni datos de usuario.

> El sitio (GitHub Pages) tiene el apex en **DNS-only** (no proxeado por Cloudflare),
> así que una Route sobre `regatas.com.ar/...` no interceptaría. Por eso el Worker
> usa un subdominio propio y la app lo llama cross-origin (habilitado por el CORS).

## Requisitos

- La zona `regatas.com.ar` en Cloudflare (ya está: el DNS se gestiona ahí).
- Node + `wrangler` (`npx wrangler`).

## Deploy

```bash
cd worker
npx wrangler login          # una vez, abre el navegador
npx wrangler deploy         # publica el Worker y crea api.regatas.com.ar (DNS + cert)
```

Probar:

```bash
curl "https://api.regatas.com.ar/metar?ids=SABE&hours=2"
```

Si la app no encuentra el endpoint (Worker no desplegado, o en localhost), la tarjeta
de "visibilidad observada" simplemente **no aparece** — el resto del panel funciona igual.

## Notas

- En desarrollo (`npm run dev`) la app usa mocks o degrada a "sin tarjeta"; el Worker
  solo hace falta en producción.
- Cobertura METAR floja en Colonia/Carmelo (aeropuertos con reporte irregular).
