#!/usr/bin/env node
/**
 * Validación del VIENTO contra medición real en el agua (ops, no parte de la app).
 *
 * El validador general compara el pronóstico contra reanálisis Open-Meteo, que
 * es el mismo modelo evaluándose a sí mismo, y el METAR sólo cubre aeropuertos
 * en tierra. Las estaciones de la CARP son las únicas que miden viento SOBRE el
 * Río de la Plata, y una de ellas —Pilote Norden— está en medio del estuario.
 *
 * La pregunta que responde: ¿el pronóstico que usa el semáforo subestima el
 * viento en agua abierta? Si el sesgo aparece sólo en Norden y no en las
 * estaciones portuarias, la causa es la fricción de la costa.
 *
 *   node scripts/carp-eval.mjs viento [--dias 60] [--estacion norden]
 *     -> Baja (y cachea) el archivo de la CARP, lo promedia a horario y lo cruza
 *        con el viento de Open-Meteo en las mismas coordenadas y horas.
 *
 *   node scripts/carp-eval.mjs referencia [--dias 92] [--estacion norden]
 *     -> Audita el "observado" que usa `forecast-eval.mjs`. Ese validador compara
 *        el pronóstico contra Open-Meteo `past_days`, o sea contra el mismo modelo
 *        evaluándose a sí mismo. Esto cuenta cuántas horas de viento fuerte REAL
 *        esa referencia no registra: si se le escapan, el validador no puede ver
 *        los fallos peligrosos que justamente busca.
 *
 * El caché vive en validation/.cache/ y va sin trackear: a diferencia de los
 * snapshots del pronóstico, este archivo se puede volver a bajar siempre.
 */
import { CARP_STATIONS, fetchArchivo, leerAnio, parseViento, aHorario } from './lib/carp.mjs';

const arg = (nombre, def) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const desvio = (a) => {
  const m = media(a);
  return Math.sqrt(media(a.map((x) => (x - m) ** 2)));
};
const correlacion = (A, B) => {
  const ma = media(A);
  const mb = media(B);
  const cov = media(A.map((a, i) => (a - ma) * (B[i] - mb)));
  return cov / (desvio(A) * desvio(B));
};
/** Diferencia angular con signo, en [-180, 180]. */
const difAngular = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

async function openMeteo(station, dias) {
  const p = new URLSearchParams({
    latitude: String(station.lat),
    longitude: String(station.lon),
    hourly: 'wind_speed_10m,wind_direction_10m',
    wind_speed_unit: 'kn',
    timezone: 'America/Argentina/Buenos_Aires',
    past_days: String(Math.min(dias, 92)), // tope de la API
    forecast_days: '1',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
  if (!res.ok) throw new Error(`Open-Meteo devolvió ${res.status}`);
  const d = await res.json();
  const vel = new Map();
  const dir = new Map();
  d.hourly.time.forEach((t, i) => {
    const k = t.slice(0, 16);
    if (d.hourly.wind_speed_10m[i] != null) vel.set(k, d.hourly.wind_speed_10m[i]);
    if (d.hourly.wind_direction_10m[i] != null) dir.set(k, d.hourly.wind_direction_10m[i]);
  });
  return { vel, dir };
}

async function evaluar(station, dias) {
  const zip = await fetchArchivo(station, 'wind');
  const anio = new Date().getFullYear();
  // Enero necesita también el año anterior para llegar a `dias` hacia atrás.
  const csv = (await leerAnio(zip, station, 'wind', anio - 1)) + (await leerAnio(zip, station, 'wind', anio));
  const filas = parseViento(csv);
  if (!filas.length) return { station, error: 'sin datos en el archivo' };

  const medKt = aHorario(filas, 'kt');
  const medDir = aHorario(filas, 'dir');
  const fc = await openMeteo(station, dias);

  const desde = new Date(Date.now() - dias * 86400_000).toISOString().slice(0, 10);
  const horas = [...medKt.keys()].filter((k) => k.slice(0, 10) >= desde && fc.vel.has(k)).sort();
  if (horas.length < 24) return { station, error: `sólo ${horas.length} horas comparables` };

  const A = horas.map((h) => medKt.get(h)); // medido
  const B = horas.map((h) => fc.vel.get(h)); // pronosticado

  // Sesgo por rango de intensidad: un modelo puede acertar con viento flojo y
  // quedarse corto justo donde el semáforo decide.
  const rangos = [
    ['0-10 kt', (v) => v < 10],
    ['10-18 kt', (v) => v >= 10 && v < 18],
    ['18-25 kt', (v) => v >= 18 && v < 25],
    ['> 25 kt', (v) => v >= 25],
  ].map(([etiqueta, test]) => {
    const idx = A.map((v, i) => (test(v) ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 10) return { etiqueta, n: idx.length };
    const a = idx.map((i) => A[i]);
    const b = idx.map((i) => B[i]);
    return { etiqueta, n: idx.length, medido: media(a), pronosticado: media(b), cociente: media(a) / media(b) };
  });

  const dirs = horas
    .filter((h) => medDir.has(h) && fc.dir.has(h))
    .map((h) => difAngular(medDir.get(h), fc.dir.get(h)));

  return {
    station,
    n: horas.length,
    desde: horas[0],
    hasta: horas[horas.length - 1],
    medido: media(A),
    pronosticado: media(B),
    cociente: media(A) / media(B),
    mae: media(A.map((v, i) => Math.abs(v - B[i]))),
    r: correlacion(A, B),
    rangos,
    dirMediana: dirs.length ? dirs.slice().sort((x, y) => x - y)[Math.floor(dirs.length / 2)] : null,
    dirMae: dirs.length ? media(dirs.map(Math.abs)) : null,
  };
}

/**
 * Cuántas horas de viento fuerte medido NO registra la referencia del validador.
 * Es la pregunta que decide si las cifras de acierto del semáforo son creíbles en
 * el régimen que importa.
 */
async function auditarReferencia(station, dias) {
  const zip = await fetchArchivo(station, 'wind');
  const anio = new Date().getFullYear();
  const csv = (await leerAnio(zip, station, 'wind', anio - 1)) + (await leerAnio(zip, station, 'wind', anio));
  const med = aHorario(parseViento(csv), 'kt');
  const fc = await openMeteo(station, dias);
  const desde = new Date(Date.now() - dias * 86400_000).toISOString().slice(0, 10);
  const horas = [...med.keys()].filter((h) => h.slice(0, 10) >= desde && fc.vel.has(h)).sort();
  if (horas.length < 24) return null;

  // Umbrales del semáforo con tolerancia normal (ver SCORING en src/lib/config/boat.ts).
  const filas = [18, 25].map((u) => {
    const reales = horas.filter((h) => med.get(h) >= u);
    const vistas = reales.filter((h) => fc.vel.get(h) >= u);
    return { u, reales: reales.length, vistas: vistas.length, perdidas: reales.length - vistas.length };
  });
  return { horas: horas.length, desde: horas[0], hasta: horas[horas.length - 1], filas };
}

async function main() {
  const dias = Number(arg('dias', 60));
  const filtro = arg('estacion', null);
  const estaciones = filtro ? CARP_STATIONS.filter((s) => s.id === filtro) : CARP_STATIONS;
  if (!estaciones.length) {
    console.error(`Estación desconocida. Opciones: ${CARP_STATIONS.map((s) => s.id).join(', ')}`);
    process.exit(1);
  }

  if (process.argv[2] === 'referencia') {
    console.log(`\nAuditoría del "observado" del validador — últimos ${dias} días\n`);
    for (const s of estaciones) {
      const r = await auditarReferencia(s, dias);
      if (!r) {
        console.log(`${s.nombre}: sin datos suficientes\n`);
        continue;
      }
      console.log(`${s.nombre} — ${r.horas} horas, ${r.desde.slice(0, 10)} a ${r.hasta.slice(0, 10)}`);
      for (const f of r.filas) {
        const pct = ((100 * f.perdidas) / Math.max(f.reales, 1)).toFixed(0);
        console.log(
          `  viento real ≥ ${f.u} kt: ${f.reales} h medidas · la referencia vio ${f.vistas} h → se le escapan ${f.perdidas} h (${pct} %)`,
        );
      }
      console.log();
    }
    console.log('Si la referencia no registra el viento fuerte, el validador no puede');
    console.log('encontrar los fallos peligrosos: sus cifras son un techo, no una medición.\n');
    return;
  }

  console.log(`\nViento medido (CARP) vs pronosticado (Open-Meteo) — últimos ${dias} días\n`);
  const resultados = [];
  for (const s of estaciones) {
    const r = await evaluar(s, dias);
    resultados.push(r);
    const sitio = s.abierta ? 'agua abierta' : 'portuaria';
    if (r.error) {
      console.log(`${s.nombre} (${sitio}): ${r.error}\n`);
      continue;
    }
    console.log(`${s.nombre} (${sitio}) — ${r.n} horas, ${r.desde.slice(0, 10)} a ${r.hasta.slice(0, 10)}`);
    console.log(`  medido ${r.medido.toFixed(2)} kt · pronosticado ${r.pronosticado.toFixed(2)} kt`);
    console.log(`  cociente medido/pronosticado ${r.cociente.toFixed(2)} · MAE ${r.mae.toFixed(2)} kt · r ${r.r >= 0 ? '+' : ''}${r.r.toFixed(3)}`);
    if (r.dirMediana != null) {
      console.log(`  dirección: error medio ${r.dirMae.toFixed(0)}°, sesgo mediano ${r.dirMediana >= 0 ? '+' : ''}${r.dirMediana.toFixed(0)}°`);
    }
    for (const b of r.rangos) {
      if (b.cociente == null) continue;
      console.log(`    ${b.etiqueta.padEnd(9)} n=${String(b.n).padStart(4)}  medido ${b.medido.toFixed(1)}  pron. ${b.pronosticado.toFixed(1)}  cociente ${b.cociente.toFixed(2)}`);
    }
    console.log();
  }

  // Lo que la comparación existe para responder.
  const ok = resultados.filter((r) => !r.error);
  const abiertas = ok.filter((r) => r.station.abierta);
  const puertos = ok.filter((r) => !r.station.abierta);
  if (abiertas.length && puertos.length) {
    const ca = media(abiertas.map((r) => r.cociente));
    const cp = media(puertos.map((r) => r.cociente));
    console.log('Agua abierta vs estaciones portuarias');
    console.log(`  cociente medio en agua abierta: ${ca.toFixed(2)}`);
    console.log(`  cociente medio en puertos:      ${cp.toFixed(2)}`);
    console.log(
      ca - cp > 0.08
        ? `  → el pronóstico se queda corto MÁS en agua abierta (+${((ca - cp) * 100).toFixed(0)} puntos): compatible con la fricción de la costa.`
        : '  → sin diferencia clara entre agua abierta y costa; el sesgo, si lo hay, no es por exposición.',
    );
    console.log();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
