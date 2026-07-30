#!/usr/bin/env node
/**
 * Validación de pronóstico (ops, no parte de la app).
 *
 *   node scripts/forecast-eval.mjs capture [lat] [lon] [nombre]
 *     -> Guarda el pronóstico de los próximos 7 días (viento, ráfagas, dirección,
 *        lluvia, visibilidad/niebla y surge) en validation/forecast-<fecha>-<lugar>.json
 *
 *   node scripts/forecast-eval.mjs validate validation/forecast-<fecha>-<lugar>.json
 *     -> Compara ese snapshot contra el observado de Open-Meteo y marca los
 *        "fallos peligrosos": días pronosticados seguros (verde / poco-viento) que
 *        resultaron peligrosos (amarillo / rojo).
 *
 * Para el reporte agregado de TODOS los snapshots (por horizonte, zona y dimensión)
 * usar scripts/forecast-report.mjs.
 *
 * El dominio (scoring/surge/fog) vive en scripts/lib/forecast-domain.mjs.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fetchHourly, scoreDays, dateOf, SAFE, DANGER, SCORING } from './lib/forecast-domain.mjs';

async function capture(lat, lon, name) {
  const hourly = await fetchHourly(lat, lon, { forecastDays: 7 });
  const { days, surge, fog } = scoreDays(hourly);
  const snap = {
    capturedAt: new Date().toISOString(),
    source: 'open-meteo-forecast',
    location: { name, lat, lon },
    thresholds: SCORING,
    days, surge, fog,
  };
  await mkdir('validation', { recursive: true });
  const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const file = `validation/forecast-${dateOf(snap.capturedAt)}-${slug}.json`;
  await writeFile(file, JSON.stringify(snap, null, 2));
  console.log(`Snapshot guardado: ${file}`);
  console.log(`Lugar: ${name} (${lat}, ${lon}) · ${days.length} días`);
  for (const d of days) {
    const vis = d.metrics.visibilityMinM != null ? `vis ${d.metrics.visibilityMinM}m` : 'vis s/d';
    console.log(`  ${d.date}  ${d.level.padEnd(12)} viento ${d.metrics.windMedianKt}kt ráf ${d.metrics.gustPeakKt}kt lluvia ${d.metrics.precipTotalMm}mm ${vis}`);
  }
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
  let hits = 0, total = 0; const dangerMiss = [];
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
