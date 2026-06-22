#!/usr/bin/env node
/**
 * Validación de pronóstico (ops, no parte de la app).
 *
 *   node scripts/forecast-eval.mjs capture [lat] [lon] [nombre]
 *     -> Guarda el pronóstico de los próximos 7 días en validation/forecast-<fecha>.json
 *
 *   node scripts/forecast-eval.mjs validate validation/forecast-<fecha>.json
 *     -> Pide los valores reales (observado de Open-Meteo) de esas fechas y los
 *        compara con lo pronosticado. Marca los "fallos peligrosos": días que se
 *        pronosticaron seguros (verde / poco-viento) pero resultaron peligrosos
 *        (amarillo / rojo).
 *
 * La lógica de scoring y surge replica src/lib/domain (umbrales SCORING normal),
 * y los umbrales quedan guardados en el snapshot para comparar con los mismos.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';

const BASE = 'https://api.open-meteo.com/v1/forecast';
const TZ = 'America/Argentina/Buenos_Aires';

// Umbrales del semáforo (mirror de src/lib/config/boat.ts, perfil normal).
const SCORING = {
  idealWindMin: 6, strongWind: 22, dangerWind: 28,
  gustYellow: 25, gustRed: 33, rainYellow: 2, rainRed: 12,
};
const SURGE = { sudestadaSector: [112, 157], bajanteSector: [292, 22], minWindKt: 18, minHours: 6 };
const DAYLIGHT = { sunriseHour: 7, sunsetHour: 19 };

const hourOf = (iso) => Number(iso.slice(11, 13));
const dateOf = (iso) => iso.slice(0, 10);
const median = (a) => { if (!a.length) return 0; const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const circMean = (a) => { if(!a.length) return 0; let x=0,y=0; for(const d of a){x+=Math.cos(d*Math.PI/180);y+=Math.sin(d*Math.PI/180);} return ((Math.atan2(y,x)*180/Math.PI)+360)%360; };
const inSector = (d,[a,b]) => { const x=((d%360)+360)%360; return a<=b ? (x>=a&&x<=b) : (x>=a||x<=b); };

async function fetchHourly(lat, lon, { pastDays = 0, forecastDays = 7 } = {}) {
  const p = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    hourly: 'temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
    wind_speed_unit: 'kn', timezone: TZ,
    past_days: String(pastDays), forecast_days: String(forecastDays),
  });
  const r = await fetch(`${BASE}?${p}`);
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  const d = await r.json();
  const h = d.hourly;
  return h.time.map((time, i) => ({
    time, windKt: h.wind_speed_10m[i], gustKt: h.wind_gusts_10m[i],
    windDir: h.wind_direction_10m[i], precipMm: h.precipitation[i], tempC: h.temperature_2m[i],
  }));
}

function detectSurge(hourly) {
  const classify = (p) => { if (p.windKt < SURGE.minWindKt) return null; if (inSector(p.windDir, SURGE.sudestadaSector)) return 'sudestada'; if (inSector(p.windDir, SURGE.bajanteSector)) return 'bajante'; return null; };
  const runs = []; let cur = null;
  hourly.forEach((p, i) => { const t = classify(p); if (cur && t === cur.type) cur.end = i; else { if (cur) runs.push(cur); cur = t ? { type: t, start: i, end: i } : null; } });
  if (cur) runs.push(cur);
  const alerts = [];
  for (const run of runs) {
    const sl = hourly.slice(run.start, run.end + 1); const dur = sl.length;
    if (dur < SURGE.minHours) continue;
    const avg = sl.reduce((s, p) => s + p.windKt, 0) / dur;
    const strong = avg >= 28, long = dur >= 12;
    const sev = strong && long ? 3 : (strong || long || dur >= 9 ? 2 : 1);
    alerts.push({ type: run.type, startsAt: sl[0].time, endsAt: sl[sl.length - 1].time, durationH: dur, severity: sev, avgWindKt: Math.round(avg) });
  }
  return alerts;
}

function scoreDay(date, points, surgeOnDay) {
  const dl = points.filter((p) => hourOf(p.time) >= DAYLIGHT.sunriseHour && hourOf(p.time) <= DAYLIGHT.sunsetHour);
  const u = dl.length ? dl : points;
  const windMedianKt = Math.round(median(u.map((p) => p.windKt)));
  const gustPeakKt = Math.round(Math.max(0, ...u.map((p) => p.gustKt)));
  const windDirDominant = Math.round(circMean(u.map((p) => p.windDir)));
  const precipTotalMm = Math.round(u.reduce((s, p) => s + p.precipMm, 0) * 10) / 10;
  const order = ['verde', 'amarillo', 'rojo']; let level = 'verde'; const reasons = [];
  const esc = (to, r) => { reasons.push(r); if (order.indexOf(to) > order.indexOf(level)) level = to; };
  if (windMedianKt >= SCORING.dangerWind) esc('rojo', `Viento muy fuerte (~${windMedianKt} kt)`);
  else if (windMedianKt >= SCORING.strongWind) esc('amarillo', `Viento fuerte (~${windMedianKt} kt)`);
  if (gustPeakKt >= SCORING.gustRed) esc('rojo', `Ráfagas peligrosas (${gustPeakKt} kt)`);
  else if (gustPeakKt >= SCORING.gustYellow) esc('amarillo', `Ráfagas marcadas (${gustPeakKt} kt)`);
  if (precipTotalMm >= SCORING.rainRed) esc('rojo', `Lluvia fuerte (${precipTotalMm} mm)`);
  else if (precipTotalMm >= SCORING.rainYellow) esc('amarillo', `Algo de lluvia (${precipTotalMm} mm)`);
  for (const a of surgeOnDay) esc(a.severity >= 2 ? 'rojo' : 'amarillo', `${a.type} sev ${a.severity}`);
  if (level === 'verde' && windMedianKt < SCORING.idealWindMin) { level = 'poco-viento'; reasons.push(`Poco viento (~${windMedianKt} kt)`); }
  if (level === 'verde' && !reasons.length) reasons.push(`Buenas condiciones (~${windMedianKt} kt)`);
  return { date, level, reasons, metrics: { windMedianKt, gustPeakKt, windDirDominant, precipTotalMm } };
}

function scoreDays(hourly) {
  const surge = detectSurge(hourly);
  const byDay = new Map();
  for (const p of hourly) { const d = dateOf(p.time); (byDay.get(d) ?? byDay.set(d, []).get(d)).push(p); }
  const days = [];
  for (const [date, pts] of byDay) {
    const onDay = surge.filter((a) => dateOf(a.startsAt) <= date && dateOf(a.endsAt) >= date);
    days.push(scoreDay(date, pts, onDay));
  }
  return { days: days.sort((a, b) => a.date.localeCompare(b.date)), surge };
}

const SAFE = new Set(['verde', 'poco-viento']);
const DANGER = new Set(['amarillo', 'rojo']);

async function capture(lat, lon, name) {
  const hourly = await fetchHourly(lat, lon, { forecastDays: 7 });
  const { days, surge } = scoreDays(hourly);
  const snap = {
    capturedAt: new Date().toISOString(),
    source: 'open-meteo-forecast',
    location: { name, lat, lon },
    thresholds: SCORING,
    days, surge,
  };
  await mkdir('validation', { recursive: true });
  const file = `validation/forecast-${dateOf(snap.capturedAt)}.json`;
  await writeFile(file, JSON.stringify(snap, null, 2));
  console.log(`Snapshot guardado: ${file}`);
  console.log(`Lugar: ${name} (${lat}, ${lon}) · ${days.length} días`);
  for (const d of days) console.log(`  ${d.date}  ${d.level.padEnd(12)} viento ${d.metrics.windMedianKt}kt ráf ${d.metrics.gustPeakKt}kt lluvia ${d.metrics.precipTotalMm}mm`);
}

async function validate(file) {
  const snap = JSON.parse(await readFile(file, 'utf8'));
  const { lat, lon, name } = snap.location;
  const dates = snap.days.map((d) => d.date);
  const today = dateOf(new Date().toISOString());
  const back = Math.ceil((Date.now() - new Date(dates[0] + 'T00:00').getTime()) / 86400000) + 1;
  const hourly = await fetchHourly(lat, lon, { pastDays: Math.min(92, Math.max(1, back)), forecastDays: 1 });
  const { days: actualDays } = scoreDays(hourly);
  const actualBy = new Map(actualDays.map((d) => [d.date, d]));

  console.log(`\nVALIDACIÓN — ${name}  (capturado ${dateOf(snap.capturedAt)}, hoy ${today})`);
  console.log('día         pronóstico    real          ¿coincide?   métricas pron→real (viento/ráfaga)');
  let hits = 0, total = 0, dangerMiss = [];
  for (const p of snap.days) {
    const a = actualBy.get(p.date);
    if (!a || p.date > today) { console.log(`  ${p.date}  ${p.level.padEnd(12)} (sin dato real aún)`); continue; }
    total++;
    const ok = p.level === a.level;
    if (ok) hits++;
    const danger = SAFE.has(p.level) && DANGER.has(a.level);
    if (danger) dangerMiss.push({ date: p.date, pred: p, act: a });
    const mark = ok ? 'sí' : (danger ? '⚠️ PELIGRO' : 'no');
    console.log(`  ${p.date}  ${p.level.padEnd(12)} ${a.level.padEnd(12)} ${mark.padEnd(11)} ${p.metrics.windMedianKt}/${a.metrics.windMedianKt}kt · ${p.metrics.gustPeakKt}/${a.metrics.gustPeakKt}kt`);
  }
  console.log(`\nAciertos de nivel: ${hits}/${total}` + (total ? ` (${Math.round(100 * hits / total)}%)` : ''));
  if (dangerMiss.length) {
    console.log(`\n⚠️  FALLOS PELIGROSOS (se pronosticó seguro, resultó peligroso): ${dangerMiss.length}`);
    for (const m of dangerMiss) {
      console.log(`  ${m.date}: pronóstico "${m.pred.level}" → real "${m.act.level}"`);
      console.log(`     real: viento ${m.act.metrics.windMedianKt}kt, ráfagas ${m.act.metrics.gustPeakKt}kt, lluvia ${m.act.metrics.precipTotalMm}mm — ${m.act.reasons.join('; ')}`);
    }
  } else if (total) {
    console.log('\n✅ Ningún fallo peligroso: no hubo días seguros que resultaran peligrosos.');
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'capture') {
  await capture(Number(args[0] ?? -34.8399), Number(args[1] ?? -57.9234), args[2] ?? 'La Plata');
} else if (cmd === 'validate') {
  if (!args[0]) { console.error('Falta el archivo de snapshot.'); process.exit(1); }
  await validate(args[0]);
} else {
  console.error('Uso: node scripts/forecast-eval.mjs capture [lat lon nombre] | validate <archivo>');
  process.exit(1);
}
