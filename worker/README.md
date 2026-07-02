# Worker METAR (proxy de visibilidad observada)

Proxy serverless de solo lectura para METAR (aviationweather.gov). Resuelve que la
app estática (GitHub Pages, detrás de Cloudflare) no puede llamar a la API por falta
de CORS. Ver el porqué en `metar.js` y en `docs/PLAN.md`.

## Qué hace

- Escucha en `regatas.com.ar/api/metar?ids=SABE&hours=2` (same-origin para la app).
- Sanitiza los `ids` (solo ICAO), llama a aviationweather server-to-server, cachea
  ~60 s y responde con CORS. Sin estado ni datos de usuario.

## Requisitos

- El dominio `regatas.com.ar` debe estar **proxeado por Cloudflare** (nube naranja),
  cosa que ya ocurre (el apex vive en Cloudflare por delante de GitHub Pages).
- Node + `wrangler` (`npx wrangler`).

## Deploy

```bash
cd worker
npx wrangler login          # una vez, abre el navegador
npx wrangler deploy         # publica el Worker y crea la ruta /api/metar*
```

Probar:

```bash
curl "https://regatas.com.ar/api/metar?ids=SABE&hours=2"
```

Si la app no encuentra el endpoint (Worker no desplegado, o en localhost), la tarjeta
de "visibilidad observada" simplemente **no aparece** — el resto del panel funciona igual.

## Notas

- En desarrollo (`npm run dev`) la app usa mocks o degrada a "sin tarjeta"; el Worker
  solo hace falta en producción.
- Cobertura METAR floja en Colonia/Carmelo (aeropuertos con reporte irregular).
