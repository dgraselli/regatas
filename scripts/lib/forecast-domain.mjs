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

export const BASE = 'https://api.open-meteo.com/v1/forecast';
export const TZ = 'America/Argentina/Buenos_Aires';

// Umbrales del semáforo (mirror de src/lib/config/boat.ts, perfil normal).
export const SCORING = {
  idealWindMin: 6, strongWind: 22, dangerWind: 28,
  gustYellow: 25, gustRed: 33, rainYellow: 2, rainRed: 12,
  fogYellowM: 4000, fogRedM: 1000,
};
export const SURGE = { sudestadaSector: [112, 157], bajanteSector: [292, 22], minWindKt: 18, minHours: 6 };
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

export async function fetchHourly(lat, lon, { pastDays = 0, forecastDays = 7 } = {}) {
  const p = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    hourly: 'temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,cloud_cover',
    wind_speed_unit: 'kn', timezone: TZ,
    past_days: String(pastDays), forecast_days: String(forecastDays),
  });
  const r = await fetch(`${BASE}?${p}`);
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  const d = await r.json();
  const h = d.hourly;
  return h.time.map((time, i) => ({
    time,
    windKt: h.wind_speed_10m[i],
    gustKt: h.wind_gusts_10m[i],
    windDir: h.wind_direction_10m[i],
    precipMm: h.precipitation[i],
    tempC: h.temperature_2m[i],
    visibilityM: h.visibility?.[i] ?? null,
    cloudCoverPct: h.cloud_cover?.[i] ?? null,
  }));
}

/** Mirror de src/lib/domain/surge.ts (detección de eventos; sin corroboración marina). */
export function detectSurge(hourly, t = SURGE) {
  const classify = (p) => { if (p.windKt < t.minWindKt) return null; if (inSector(p.windDir, t.sudestadaSector)) return 'sudestada'; if (inSector(p.windDir, t.bajanteSector)) return 'bajante'; return null; };
  const runs = []; let cur = null;
  hourly.forEach((p, i) => { const ty = classify(p); if (cur && ty === cur.type) cur.end = i; else { if (cur) runs.push(cur); cur = ty ? { type: ty, start: i, end: i } : null; } });
  if (cur) runs.push(cur);
  const alerts = [];
  for (const run of runs) {
    const sl = hourly.slice(run.start, run.end + 1); const dur = sl.length;
    if (dur < t.minHours) continue;
    const avg = sl.reduce((s, p) => s + p.windKt, 0) / dur;
    const strong = avg >= 28, long = dur >= 12;
    const sev = strong && long ? 3 : (strong || long || dur >= 9 ? 2 : 1);
    alerts.push({ type: run.type, startsAt: sl[0].time, endsAt: sl[sl.length - 1].time, durationH: dur, severity: sev, avgWindKt: Math.round(avg) });
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

  for (const a of surgeOnDay) esc(a.severity >= 2 ? 'rojo' : 'amarillo', `${a.type} sev ${a.severity}`);
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
    const onDay = surge.filter((a) => dateOf(a.startsAt) <= date && dateOf(a.endsAt) >= date);
    days.push(scoreDay(date, pts, onDay, t));
  }
  return { days: days.sort((a, b) => a.date.localeCompare(b.date)), surge, fog };
}

export const SAFE = new Set(['verde', 'poco-viento']);
export const DANGER = new Set(['amarillo', 'rojo']);
