/**
 * fetch con reintentos, para las capturas diarias (ops, no parte de la app).
 *
 * Las capturas corren una sola vez por día y lo que no se baja ese día no se
 * recupera: aviationweather.gov guarda ~3-4 días y Open-Meteo no devuelve el
 * pronóstico que emitió en el pasado. El 2026-09-25 un único ETIMEDOUT contra
 * aviationweather hizo perder el día entero de METAR de las 5 estaciones.
 *
 * Reintenta ante errores de red, timeouts, 429 y 5xx; un 4xx es un error
 * nuestro (URL mal armada) y reintentarlo no lo arregla.
 */
const WAITS_MS = [10_000, 30_000, 90_000];
const TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (status) => status === 429 || status >= 500;

export async function fetchRetry(url, { label = url, waits = WAITS_MS, timeoutMs = TIMEOUT_MS } = {}) {
  for (let attempt = 0; ; attempt++) {
    let why;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok || !retryable(res.status)) return res;
      why = `HTTP ${res.status}`;
    } catch (err) {
      why = err?.cause?.code ?? err?.name ?? String(err);
    }
    if (attempt >= waits.length) throw new Error(`${label}: falló tras ${attempt + 1} intentos (${why})`);
    console.error(`  ${label}: ${why}; reintento en ${waits[attempt] / 1000}s…`);
    await sleep(waits[attempt]);
  }
}
