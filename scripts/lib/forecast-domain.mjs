/**
 * Mirror del dominio de la app (src/lib/domain) para los scripts de validación
 * de pronóstico (ops, no parte de la app). Replica scoring + surge + fog con los
 * umbrales del perfil "normal". Sin I/O de la app: solo Open-Meteo.
 *
 * Mantener alineado con:
 *   src/lib/domain/scoring.ts, surge.ts, fog.ts
 *   src/lib/config/boat.ts (SCORING, SURGE, DAYLIGHT)
 *   src/lib/services/openMeteoForecast.ts (campos hourly)
 */

import { fetchRetry } from './fetch-retry.mjs';

export const BASE = 'https://api.open-meteo.com/v1/forecast';
/**
 * Archivo (reanálisis ERA5). La API de pronóstico rellena el pasado sólo ~58
 * días —más atrás devuelve el eje temporal con valores nulos—, así que sin esto
 * los snapshots viejos no se pueden validar por más que se sigan juntando.
 *
 * Medido en el solapamiento (1283 horas, Buenos Aires): las dos fuentes difieren
 * 0.06 kt de sesgo y 0.08 kt de MAE, y sólo el 2 % de las horas se aparta más de
 * 2 kt. O sea que combinarlas no mete un escalón en la serie.
 *
 * Lo que ERA5 NO trae es visibilidad: devuelve la columna entera en null. La
 * niebla, entonces, se sigue validando sólo sobre la ventana de la API de
 * pronóstico.
 */
export const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
/** Latencia del archivo ERA5: pedirle los últimos días devuelve 400. */
const ARCHIVE_LAG_D = 6;
export const TZ = 'America/Argentina/Buenos_Aires';

// Umbrales del semáforo (mirror de src/lib/config/boat.ts, perfil normal).
export const SCORING = {
  idealWindMin: 6, strongWind: 22, dangerWind: 28,
  gustYellow: 25, gustRed: 33, rainYellow: 2, rainRed: 12,
  fogYellowM: 4000, fogRedM: 1000,
};
// Mirror de SURGE (src/lib/config/boat.ts): por nivel del mar filtrado; viento sólo de respaldo.
export const SURGE = {
  seaLevelHighM: 0.45, seaLevelLowM: -0.15, seaLevelHighSevM: [0.6, 0.75], seaLevelLowSevM: [-0.25, -0.35], seaLevelMinHours: 3,
  sudestadaSector: [150, 210], bajanteSector: [292, 22], minWindKt: 10, minHours: 6,
};
export const DAYLIGHT = { sunriseHour: 7, sunsetHour: 19 };

// Ventanas de niebla en el scoring (mirror de scoring.ts).
const FOG_NAVIGABLE_WINDOW_H = 4;
const FOG_PRECAUTION_MIN_H = 2;

export const hourOf = (iso) => Number(iso.slice(11, 13));
export const dateOf = (iso) => iso.slice(0, 10);
export const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const circMean = (a) => { if (!a.length) return 0; let x = 0, y = 0; for (const d of a) { x += Math.cos(d * Math.PI / 180); y += Math.sin(d * Math.PI / 180); } return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360; };
export const inSector = (d, [a, b]) => { const x = ((d % 360) + 360) % 360; return a <= b ? (x >= a && x <= b) : (x >= a || x <= b); };
/** Diferencia angular mínima entre dos rumbos (0..180). */
export const angularDiff = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };

const HOURLY_VARS =
  'temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,cloud_cover';

const mapHourly = (h) =>
  h.time.map((time, i) => ({
    time,
    windKt: h.wind_speed_10m[i],
    gustKt: h.wind_gusts_10m[i],
    windDir: h.wind_direction_10m[i],
    precipMm: h.precipitation[i],
    tempC: h.temperature_2m[i],
    visibilityM: h.visibility?.[i] ?? null,
    cloudCoverPct: h.cloud_cover?.[i] ?? null,
  }));

const isoDia = (ms) => new Date(ms).toISOString().slice(0, 10);

const MARINE = 'https://marine-api.open-meteo.com/v1/marine';

/**
 * Nivel del mar de Open-Meteo Marine por hora (Map time → m), que es con lo que
 * la app detecta sudestada/bajante. `range` es { pastDays, forecastDays } o
 * { start, end }. Si Marine falla devuelve un Map vacío y la detección cae al
 * respaldo por viento, igual que en la app.
 */
export async function fetchSeaLevel(lat, lon, range) {
  const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), hourly: 'sea_level_height_msl', timezone: TZ });
  if (range.start) { p.set('start_date', range.start); p.set('end_date', range.end); }
  else { p.set('past_days', String(range.pastDays ?? 0)); p.set('forecast_days', String(range.forecastDays ?? 7)); }
  try {
    const r = await fetchRetry(`${MARINE}?${p}`, { label: 'Marine' });
    if (!r.ok) throw new Error(`Marine HTTP ${r.status}`);
    const h = (await r.json()).hourly;
    return new Map(h.time.map((t, i) => [t, h.sea_level_height_msl[i]]).filter(([, v]) => v != null));
  } catch (err) {
    console.error(`  Marine sin datos (${err.message}): la marea se detecta por viento.`);
    return new Map();
  }
}

const withSeaLevel = (points, sea) => points.map((p) => ({ ...p, seaLevelM: sea.get(p.time) ?? null }));

/**
 * Serie horaria OBSERVADA desde `from` (YYYY-MM-DD) hasta hoy, combinando el
 * archivo ERA5 para el grueso y la API de pronóstico para los últimos días, que
 * el archivo todavía no tiene. Es lo que el validador debe usar como "real":
 * `fetchHourly` con `pastDays` sólo alcanza ~58 días hacia atrás.
 */
export async function fetchObservedHourly(lat, lon, from) {
  const corte = isoDia(Date.now() - ARCHIVE_LAG_D * 86400_000);
  const porHora = new Map();

  if (from < corte) {
    const p = new URLSearchParams({
      latitude: String(lat), longitude: String(lon), hourly: HOURLY_VARS,
      wind_speed_unit: 'kn', timezone: TZ, start_date: from, end_date: corte,
    });
    const r = await fetch(`${ARCHIVE}?${p}`);
    if (r.ok) for (const p2 of mapHourly((await r.json()).hourly)) porHora.set(p2.time, p2);
  }

  // La cola se pide con la ventana COMPLETA, no sólo los días que al archivo le
  // faltan: ERA5 devuelve la columna `visibility` entera en null, así que la
  // niebla sólo se puede validar con lo que sirve la API de pronóstico. Pedir de
  // más no cuesta (una sola llamada) y evita que validar más días de viento
  // achique la ventana de niebla.
  const cola = await fetchHourly(lat, lon, { pastDays: 92, forecastDays: 1 });
  for (const p2 of cola) if (Number.isFinite(p2.windKt)) porHora.set(p2.time, p2);

  // El "observado" de la marea es el análisis de Marine (día 0), que sigue al
  // mareógrafo con r = 0.96; el dato medido de verdad lo cruza nivel-eval.mjs.
  const sea = await fetchSeaLevel(lat, lon, { start: from, end: isoDia(Date.now()) });
  return withSeaLevel([...porHora.values()], sea).sort((a, b) => a.time.localeCompare(b.time));
}

export async function fetchHourly(lat, lon, { pastDays = 0, forecastDays = 7 } = {}) {
  const p = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    hourly: HOURLY_VARS,
    wind_speed_unit: 'kn', timezone: TZ,
    past_days: String(pastDays), forecast_days: String(forecastDays),
  });
  const r = await fetchRetry(`${BASE}?${p}`, { label: 'Open-Meteo' });
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  const points = mapHourly((await r.json()).hourly);
  return withSeaLevel(points, await fetchSeaLevel(lat, lon, { pastDays, forecastDays }));
}

/** Mirror de tidalFilter (src/lib/domain/surge.ts): media móvil centrada de 25 h. */
export function tidalFilter(levels) {
  return levels.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = i - 12; j <= i + 12; j++) if (levels[j] != null) { sum += levels[j]; n++; }
    return n >= 13 ? sum / n : null;
  });
}

/** Mirror de src/lib/domain/surge.ts: por nivel del mar si lo hay, si no por viento. */
export function detectSurge(hourly, t = SURGE) {
  const group = (typeAt) => { const runs = []; let cur = null; hourly.forEach((_, i) => { const ty = typeAt(i); if (cur && ty === cur.type) cur.end = i; else { if (cur) runs.push(cur); cur = ty ? { type: ty, start: i, end: i } : null; } }); if (cur) runs.push(cur); return runs; };
  const alerts = [];
  const levels = hourly.map((p) => p.seaLevelM ?? null);
  if (levels.filter((v) => v != null).length >= 24) {
    const f = tidalFilter(levels);
    for (const run of group((i) => f[i] == null ? null : f[i] >= t.seaLevelHighM ? 'sudestada' : f[i] <= t.seaLevelLowM ? 'bajante' : null)) {
      const dur = run.end - run.start + 1; if (dur < t.seaLevelMinHours) continue;
      const sl = hourly.slice(run.start, run.end + 1), lv = f.slice(run.start, run.end + 1);
      const alta = run.type === 'sudestada', peak = alta ? Math.max(...lv) : Math.min(...lv);
      const [s2, s3] = alta ? t.seaLevelHighSevM : t.seaLevelLowSevM; const past = (c) => (alta ? peak >= c : peak <= c);
      alerts.push({ type: run.type, startsAt: sl[0].time, endsAt: sl[sl.length - 1].time, durationH: dur, severity: past(s3) ? 3 : past(s2) ? 2 : 1,
        avgWindKt: Math.round(sl.reduce((s, p) => s + p.windKt, 0) / dur), source: 'nivel', peakLevelM: Math.round(peak * 100) / 100 });
    }
    return alerts;
  }
  const classify = (p) => { if (p.windKt < t.minWindKt) return null; if (inSector(p.windDir, t.sudestadaSector)) return 'sudestada'; if (inSector(p.windDir, t.bajanteSector)) return 'bajante'; return null; };
  for (const run of group((i) => classify(hourly[i]))) {
    const sl = hourly.slice(run.start, run.end + 1); const dur = sl.length;
    if (dur < t.minHours) continue;
    const avg = sl.reduce((s, p) => s + p.windKt, 0) / dur;
    const strong = avg >= 18, long = dur >= 12;
    alerts.push({ type: run.type, startsAt: sl[0].time, endsAt: sl[sl.length - 1].time, durationH: dur, severity: strong && long ? 3 : strong || long ? 2 : 1, avgWindKt: Math.round(avg), source: 'viento' });
  }
  return alerts;
}

/** Mirror de src/lib/domain/fog.ts (ventanas de visibilidad reducida). */
export function detectFog(hourly, t = SCORING) {
  if (!hourly.length) return [];
  const runs = []; let cur = null;
  hourly.forEach((p, i) => { const low = p.visibilityM != null && p.visibilityM <= t.fogYellowM; if (cur && low) cur.end = i; else { if (cur) runs.push(cur); cur = low ? { start: i, end: i } : null; } });
  if (cur) runs.push(cur);
  const alerts = [];
  for (const run of runs) {
    const sl = hourly.slice(run.start, run.end + 1);
    const vis = sl.map((p) => p.visibilityM).filter((v) => v != null);
    const minVisibilityM = Math.round(Math.min(...vis));
    const severity = minVisibilityM <= t.fogRedM ? 2 : 1;
    alerts.push({ startsAt: sl[0].time, endsAt: sl[sl.length - 1].time, durationH: sl.length, severity, minVisibilityM });
  }
  return alerts;
}

const ORDER = ['verde', 'amarillo', 'rojo'];

/** Mirror de src/lib/domain/scoring.ts scoreDay (perfil normal). */
export function scoreDay(date, points, surgeOnDay = [], t = SCORING) {
  const dl = points.filter((p) => hourOf(p.time) >= DAYLIGHT.sunriseHour && hourOf(p.time) <= DAYLIGHT.sunsetHour);
  const u = dl.length ? dl : points;
  const windMedianKt = Math.round(median(u.map((p) => p.windKt)));
  const gustPeakKt = Math.round(Math.max(0, ...u.map((p) => p.gustKt)));
  const windDirDominant = Math.round(circMean(u.map((p) => p.windDir)));
  const precipTotalMm = Math.round(u.reduce((s, p) => s + p.precipMm, 0) * 10) / 10;
  const visVals = u.map((p) => p.visibilityM).filter((v) => v != null);
  const visibilityMinM = visVals.length ? Math.round(Math.min(...visVals)) : null;

  const reasons = []; let level = 'verde';
  const esc = (to, r) => { reasons.push(r); if (ORDER.indexOf(to) > ORDER.indexOf(level)) level = to; };

  if (windMedianKt >= t.dangerWind) esc('rojo', `Viento muy fuerte (~${windMedianKt} kt)`);
  else if (windMedianKt >= t.strongWind) esc('amarillo', `Viento fuerte (~${windMedianKt} kt)`);
  if (gustPeakKt >= t.gustRed) esc('rojo', `Ráfagas peligrosas (${gustPeakKt} kt)`);
  else if (gustPeakKt >= t.gustYellow) esc('amarillo', `Ráfagas marcadas (${gustPeakKt} kt)`);
  if (precipTotalMm >= t.rainRed) esc('rojo', `Lluvia fuerte (${precipTotalMm} mm)`);
  else if (precipTotalMm >= t.rainYellow) esc('amarillo', `Algo de lluvia (${precipTotalMm} mm)`);

  // Niebla (mirror del bloque de scoring.ts: ventana navegable + niebla densa).
  const foggy = u.filter((p) => p.visibilityM != null && p.visibilityM <= t.fogYellowM);
  if (foggy.length) {
    const minVis = Math.round(Math.min(...foggy.map((p) => p.visibilityM)));
    const dense = minVis <= t.fogRedM;
    const durationH = foggy.length;
    const firstFoggyHour = Math.min(...foggy.map((p) => hourOf(p.time)));
    const lastFoggyHour = Math.max(...foggy.map((p) => hourOf(p.time)));
    const isClear = (p) => p.visibilityM == null || p.visibilityM > t.fogYellowM;
    const clearAfter = u.filter((p) => hourOf(p.time) > lastFoggyHour && isClear(p)).length;
    const clearBefore = u.filter((p) => hourOf(p.time) < firstFoggyHour && isClear(p)).length;
    const navigable = clearAfter >= FOG_NAVIGABLE_WINDOW_H || clearBefore >= FOG_NAVIGABLE_WINDOW_H;
    if (!navigable) esc(dense ? 'rojo' : 'amarillo', dense ? `Niebla buena parte del día (mín ${minVis} m)` : `Visibilidad reducida (${minVis} m)`);
    else if (dense && durationH > FOG_PRECAUTION_MIN_H) esc('amarillo', `Niebla varias horas (mín ${minVis} m, ${durationH} h)`);
    // else: niebla temporal que despeja, no degrada (partialFog en la app).
  }

  for (const a of surgeOnDay) esc(a.severity >= 3 ? 'rojo' : 'amarillo', `${a.type} sev ${a.severity}`);
  if (level === 'verde' && windMedianKt < t.idealWindMin) { level = 'poco-viento'; reasons.push(`Poco viento (~${windMedianKt} kt)`); }
  if (level === 'verde' && !reasons.length) reasons.push(`Buenas condiciones (~${windMedianKt} kt)`);

  return { date, level, reasons, metrics: { windMedianKt, gustPeakKt, windDirDominant, precipTotalMm, visibilityMinM } };
}

/** Califica todos los días del pronóstico horario; devuelve días + alertas de surge/fog. */
export function scoreDays(hourly, t = SCORING) {
  const surge = detectSurge(hourly);
  const fog = detectFog(hourly, t);
  const byDay = new Map();
  for (const p of hourly) { const d = dateOf(p.time); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(p); }
  const days = [];
  for (const [date, pts] of byDay) {
    // Open-Meteo devuelve el eje temporal COMPLETO del rango pedido, pero con
    // valores nulos más allá de su retención real (con past_days=92 llegan ~58
    // días de datos y el resto viene vacío). Sin este filtro esos días entraban
    // con viento 0 y el validador los contaba como fallos del pronóstico: el
    // acierto de viento caía de ~85 % a 56 % a medida que crecía el archivo de
    // snapshots, simulando una degradación que no existía.
    if (!pts.some((p) => Number.isFinite(p.windKt))) continue;
    const onDay = surge.filter((a) => dateOf(a.startsAt) <= date && dateOf(a.endsAt) >= date);
    days.push(scoreDay(date, pts, onDay, t));
  }
  return { days: days.sort((a, b) => a.date.localeCompare(b.date)), surge, fog };
}

export const SAFE = new Set(['verde', 'poco-viento']);
export const DANGER = new Set(['amarillo', 'rojo']);
