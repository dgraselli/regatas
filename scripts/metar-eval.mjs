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
 *     -> Agrega la observación METAR actual de las 6 zonas a
 *        validation/metar-observado.jsonl (para acumular más allá de la ventana de 7 días).
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
  const raw = await fetchMetarHistory(icaos, 2);
  const latest = new Map(); // icao -> obs más reciente
  for (const r of raw) {
    const o = normalizeMetar(r);
    const cur = latest.get(r.icaoId);
    if (!cur || (o.time ?? '') > (cur.time ?? '')) latest.set(r.icaoId, o);
  }
  const lines = [];
  for (const { z, st } of stations) {
    const o = latest.get(st.icao);
    if (!o) continue;
    lines.push(JSON.stringify({ capturedAt: new Date().toISOString(), zone: z.name, station: st.icao, distanceKm: st.distanceKm, ...o }));
    console.log(`  ${z.name.padEnd(12)} ${st.icao} ${o.time ?? ''} vis=${o.visibilityM ?? 's/d'}m ${o.fog ? 'FG' : ''}${o.mist ? 'BR' : ''} spread=${o.spreadC ?? '?'}`);
  }
  const prev = await readFile('validation/metar-observado.jsonl', 'utf8').catch(() => '');
  await writeFile('validation/metar-observado.jsonl', prev + lines.join('\n') + '\n');
  console.log(`\n${lines.length} observaciones agregadas a validation/metar-observado.jsonl`);
}

const cmd = process.argv[2];
if (cmd === 'report') await report();
else if (cmd === 'capture') await capture();
else { console.error('Uso: node scripts/metar-eval.mjs report | capture'); process.exit(1); }
