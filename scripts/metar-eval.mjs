#!/usr/bin/env node
/**
 * Validación de NIEBLA contra observación real METAR (ops, no parte de la app).
 * El "observado" del validador general es reanálisis Open-Meteo (flojo para
 * niebla); acá se usa la visibilidad MEDIDA en los aeropuertos (aviationweather.gov,
 * hasta 7 días de historia horaria).
 *
 *   node scripts/metar-eval.mjs report
 *     -> Cruza los snapshots validation/forecast-*.json con la visibilidad METAR
 *        observada esos días (por zona/horizonte) y marca los FALLOS de niebla:
 *        días pronosticados despejados que resultaron con niebla real.
 *
 *   node scripts/metar-eval.mjs capture
 *     -> Acumula la serie HORARIA de METAR de las 6 zonas en
 *        validation/metar-observado.jsonl, para poder validar niebla más allá de la
 *        ventana de 7 días que expone aviationweather.gov. Pensado para cron 1×/día
 *        (lo corre scripts/snapshot-diario.sh). Idempotente: no duplica.
 */
import { writeFile, readFile, readdir } from 'node:fs/promises';
import {
  normalizeMetar, metarVisibilityLevel, nearestMetarStation, fetchMetarHistory, localDate,
} from './lib/metar.mjs';
import { SCORING } from './lib/forecast-domain.mjs';

const TH = { fogYellowM: SCORING?.fogYellowM ?? 4000, fogRedM: SCORING?.fogRedM ?? 1000 };
const DAYLIGHT = [7, 19]; // horas locales aprox. (el detalle fino no cambia la niebla matinal)
const localHour = (iso) => Number(new Date(new Date(iso).getTime() - 3 * 3600_000).getUTCHours());

/** Nivel de visibilidad observado por fecha local, en la ventana diurna (mínimo del día). */
function observedByDate(rawObs) {
  const byDate = new Map(); // date -> { minVis, fog, worst }
  for (const raw of rawObs) {
    const o = normalizeMetar(raw);
    if (!o.time) continue;
    const h = localHour(o.time);
    if (h < DAYLIGHT[0] || h > DAYLIGHT[1]) continue;
    const d = localDate(o.time);
    const cur = byDate.get(d) ?? { minVis: Infinity, fog: false, n: 0 };
    if (o.visibilityM != null) cur.minVis = Math.min(cur.minVis, o.visibilityM);
    cur.fog = cur.fog || o.fog;
    cur.n++;
    byDate.set(d, cur);
  }
  const out = new Map();
  for (const [d, v] of byDate) {
    const visibilityM = Number.isFinite(v.minVis) ? v.minVis : undefined;
    out.set(d, { level: metarVisibilityLevel({ visibilityM, fog: v.fog }, TH), visibilityM, n: v.n });
  }
  return out;
}

const RANK = { despejado: 0, neblina: 1, niebla: 2 };
const predLevel = (visMinM) =>
  visMinM == null ? 'sin-dato' : metarVisibilityLevel({ visibilityM: visMinM }, TH);

async function report() {
  const files = (await readdir('validation')).filter((f) => /^forecast-.*\.json$/.test(f));
  if (!files.length) { console.error('No hay snapshots en validation/.'); return; }

  const snaps = [];
  for (const f of files) snaps.push(JSON.parse(await readFile(`validation/${f}`, 'utf8')));

  // Estación METAR por zona (según la lat/lon del snapshot).
  const zones = new Map(); // zoneName -> station
  for (const s of snaps) {
    if (!zones.has(s.location.name)) zones.set(s.location.name, nearestMetarStation(s.location.lat, s.location.lon));
  }
  const icaos = [...new Set([...zones.values()].map((z) => z.icao))];
  console.log(`Estaciones: ${[...zones].map(([z, st]) => `${z}→${st.icao} (${st.distanceKm}km)`).join(', ')}`);

  const raw = await fetchMetarHistory(icaos, 168);
  const byStation = new Map();
  for (const r of raw) (byStation.get(r.icaoId) ?? byStation.set(r.icaoId, []).get(r.icaoId)).push(r);
  const observedByStation = new Map();
  for (const [ic, list] of byStation) observedByStation.set(ic, observedByDate(list));

  let total = 0, hits = 0; const fogMiss = []; const observedFogDays = [];
  console.log('\nzona         día         horizonte  pron       observado(METAR)   vis.obs');
  for (const s of snaps) {
    const st = zones.get(s.location.name);
    const obs = observedByStation.get(st.icao);
    if (!obs) continue;
    const capDate = s.capturedAt.slice(0, 10);
    for (const day of s.days) {
      const o = obs.get(day.date);
      if (!o || o.level === 'sin-dato') continue;
      const pred = predLevel(day.metrics?.visibilityMinM);
      if (pred === 'sin-dato') continue;
      total++;
      const ok = pred === o.level;
      if (ok) hits++;
      const horizon = Math.round((new Date(day.date) - new Date(capDate)) / 86400000);
      // Fallo de niebla: se pronosticó mejor visibilidad que la observada real.
      const miss = RANK[pred] < RANK[o.level];
      if (miss) fogMiss.push({ zone: s.location.name, date: day.date, horizon, pred, obs: o });
      if (o.level === 'niebla') observedFogDays.push({ zone: s.location.name, date: day.date, pred, horizon });
      const mark = ok ? '' : (miss ? '  ⚠️ subestimó' : '  (sobreestimó)');
      const visStr = o.visibilityM != null ? `${(o.visibilityM / 1000).toFixed(1)}km` : 's/d';
      console.log(
        `  ${s.location.name.padEnd(12)} ${day.date}  +${horizon}        ${pred.padEnd(10)} ${o.level.padEnd(16)} ${visStr}${mark}`,
      );
    }
  }

  console.log(`\nDías comparados: ${total} · coincidencias de nivel: ${hits}${total ? ` (${Math.round(100 * hits / total)}%)` : ''}`);
  console.log(`Días con niebla observada: ${observedFogDays.length}`);
  if (fogMiss.length) {
    console.log(`\n⚠️  SUBESTIMACIONES DE NIEBLA (pronóstico mejor que lo observado): ${fogMiss.length}`);
    for (const m of fogMiss) {
      const vis = m.obs.visibilityM != null ? `${(m.obs.visibilityM / 1000).toFixed(1)}km` : 's/d';
      console.log(`  ${m.zone} ${m.date} (+${m.horizon}): pron "${m.pred}" → observado "${m.obs.level}" (${vis})`);
    }
  } else if (total) {
    console.log('\n✅ Ninguna subestimación de niebla en los snapshots disponibles.');
  }
}

// Ventana que se pide en cada corrida. El cron corre 1×/día, así que con 24 h
// alcanzaría, pero se pide el máximo nominal (168 h) porque las repetidas se
// descartan por clave: el único costo es una respuesta HTTP más grande y, a cambio,
// unos días de máquina apagada no dejan hueco. Los huecos son IRREVERSIBLES: pasada
// la ventana, aviationweather.gov ya no devuelve esas horas.
// Medido el 2026-07-30: pidiendo 168 h devuelve ~3-4 días, no 7. O sea que la
// retención real es menor que la nominal y conviene no saltearse muchos días.
const CAPTURE_HOURS = 168;
const OBS_FILE = 'validation/metar-observado.jsonl';

/**
 * Acumula la serie HORARIA de METAR en un .jsonl, para poder validar niebla más allá
 * de la ventana de 7 días que expone aviationweather.gov.
 *
 * Guarda TODAS las observaciones de la ventana, no la última: la métrica que importa
 * es la visibilidad MÍNIMA del día, y con una sola muestra diaria no se puede calcular
 * (la niebla del Plata es de madrugada y se levanta en un par de horas).
 *
 * Idempotente: la clave estación+hora ya guardada se saltea, así que se puede correr
 * de más sin ensuciar el archivo.
 */
async function capture() {
  const ZONES = [
    { name: 'Buenos Aires', lat: -34.6, lon: -58.37 },
    { name: 'Carmelo', lat: -33.997, lon: -58.293 },
    { name: 'Colonia', lat: -34.472, lon: -57.851 },
    { name: 'La Plata', lat: -34.8399, lon: -57.9234 },
    { name: 'Montevideo', lat: -34.912, lon: -56.137 },
    { name: 'San Fernando', lat: -34.433, lon: -58.55 },
  ];
  const stations = ZONES.map((z) => ({ z, st: nearestMetarStation(z.lat, z.lon) }));
  const icaos = [...new Set(stations.map((s) => s.st.icao))];

  // Qué hay ya en el archivo, para no repetir.
  const prev = await readFile(OBS_FILE, 'utf8').catch(() => '');
  const seen = new Set();
  for (const line of prev.split('\n')) {
    if (!line.trim()) continue;
    try { const o = JSON.parse(line); seen.add(`${o.station}|${o.time}`); } catch { /* línea rota: se ignora */ }
  }

  // Una observación pertenece a la ESTACIÓN, no a la zona: SADF cubre a la vez
  // San Fernando y Carmelo. Se guarda una fila por estación+hora (con las zonas que
  // la usan), y quien la lea mapea zona→estación con nearestMetarStation().
  const zonesOf = new Map(); // icao -> [zonas]
  for (const { z, st } of stations) zonesOf.set(st.icao, [...(zonesOf.get(st.icao) ?? []), z.name]);

  const raw = await fetchMetarHistory(icaos, CAPTURE_HOURS);
  const capturedAt = new Date().toISOString();
  const lines = [];
  const perStation = new Map(); // icao -> {nuevas, minVis}
  let dup = 0;

  for (const r of raw) {
    const icao = r.icaoId;
    if (!zonesOf.has(icao)) continue;
    const o = normalizeMetar(r);
    if (!o.time) continue;
    const key = `${icao}|${o.time}`;
    if (seen.has(key)) { dup++; continue; }
    seen.add(key);
    lines.push(JSON.stringify({ capturedAt, station: icao, zones: zonesOf.get(icao), ...o }));
    const a = perStation.get(icao) ?? { nuevas: 0, minVis: null };
    a.nuevas++;
    if (o.visibilityM != null && (a.minVis == null || o.visibilityM < a.minVis)) a.minVis = o.visibilityM;
    perStation.set(icao, a);
  }

  for (const icao of icaos) {
    const a = perStation.get(icao) ?? { nuevas: 0, minVis: null };
    const vis = a.minVis == null ? 's/d' : `${a.minVis}m`;
    const flag = a.minVis != null && a.minVis <= TH.fogYellowM ? '  ← niebla/neblina' : '';
    console.log(`  ${icao}  ${String(a.nuevas).padStart(2)} obs nuevas · vis mín ${String(vis).padStart(6)}${flag}   ${zonesOf.get(icao).join(', ')}`);
  }

  if (!lines.length) {
    console.log(`\nSin observaciones nuevas (${dup} ya estaban). ${OBS_FILE} sin cambios.`);
    return;
  }
  // El archivo siempre termina en \n, así que se concatena directo.
  await writeFile(OBS_FILE, prev + lines.join('\n') + '\n');
  const total = seen.size;
  console.log(`\n${lines.length} observaciones nuevas (${dup} repetidas salteadas) → ${OBS_FILE}`);
  console.log(`Total acumulado: ${total} observaciones.`);
}

const cmd = process.argv[2];
if (cmd === 'report') await report();
else if (cmd === 'capture') await capture();
else { console.error('Uso: node scripts/metar-eval.mjs report | capture'); process.exit(1); }
