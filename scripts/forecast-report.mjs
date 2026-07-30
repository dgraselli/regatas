#!/usr/bin/env node
/**
 * Reporte de validación del pronóstico (ops, no parte de la app).
 *
 *   node scripts/forecast-report.mjs
 *
 * Lee TODOS los snapshots de validation/forecast-*.json, los compara contra el
 * observado de Open-Meteo (reanálisis) y agrega los resultados para responder:
 * ¿cuán bien funciona el pronóstico a +1, +2, … +7 días, en cada zona y dimensión?
 *
 * Dimensiones:
 *   - Viento (mediano) y ráfagas: error medio en kt (MAE) y sesgo (pron−real).
 *   - Dirección dominante: error angular medio en grados (solo con viento ≥5 kt).
 *   - Lluvia: error medio en mm.
 *   - Niebla (visibilidad ≤4 km): aciertos / no detectadas / falsas alarmas.
 *   - Sudestada / bajante (marea meteorológica): ídem, evento por día.
 *   - Nivel del semáforo: tres métricas distintas, porque una sola engaña.
 *     El nivel es un `max` sobre 5 tests de umbral (viento/ráfaga/lluvia/niebla/
 *     marea), así que exigir igualdad exacta de etiqueta castiga mucho más que
 *     el MAE de una variable suelta; y `poco-viento` no es una severidad sino una
 *     anotación para vela, con lo cual verde↔poco-viento no cambia ninguna decisión.
 *       · Decisión  = seguro vs peligroso (binario). LA MÉTRICA DE PRODUCTO.
 *       · Severidad = exacto fusionando verde+poco-viento en "seguro".
 *       · Exacto    = igualdad de las 4 clases. Diagnóstico interno, el más duro.
 *     Más "fallos peligrosos" (dijo seguro, salió peligroso), que es el error caro.
 *
 * Nota: el "observado" de Open-Meteo es reanálisis/best-estimate, no una estación
 * física. La niebla solo se valida en snapshots que la hayan guardado (los viejos
 * no tienen visibilidad → se omiten de esa métrica).
 *
 * El dominio (scoring/surge/fog) vive en scripts/lib/forecast-domain.mjs.
 */
import { readdir, readFile } from 'node:fs/promises';
import {
  fetchHourly, scoreDays, dateOf, angularDiff, SCORING, SAFE, DANGER,
} from './lib/forecast-domain.mjs';

const DIR = 'America/Argentina/Buenos_Aires';
const DIR_MIN_WIND = 5; // kt: por debajo de esto la dirección no es significativa.
const FOG_M = SCORING.fogYellowM;
const today = dateOf(new Date().toLocaleString('sv', { timeZone: DIR }).replace(' ', 'T'));

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const fx = (v, d = 1) => (v == null ? '—' : v.toFixed(d));
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

/** ¿Hay un evento de surge (sudestada/bajante) activo ese día en la lista? */
const surgeOn = (alerts, date) =>
  (alerts ?? []).some((a) => dateOf(a.startsAt) <= date && dateOf(a.endsAt) >= date);

/** Flag de niebla del día a partir de la visibilidad mínima guardada/observada. */
const fogFlag = (visMinM) => (visMinM == null ? null : visMinM <= FOG_M);

function newBucket() {
  return {
    n: 0,
    wind: [], windBias: [], gust: [], gustBias: [], dir: [], rain: [],
    fog: { tp: 0, fp: 0, fn: 0, tn: 0, n: 0 },
    surge: { tp: 0, fp: 0, fn: 0, tn: 0 },
    // Nivel del semáforo, tres lecturas (ver cabecera del archivo).
    levelHits: 0,     // igualdad exacta de las 4 clases
    mergedHits: 0,    // ídem fusionando verde+poco-viento (ambos "seguro")
    binHits: 0,       // solo seguro-vs-peligroso: la decisión real
    dangerMiss: 0,    // dijo seguro, salió peligroso
    conservative: 0,  // avisó peligro, salió seguro
    bothDanger: 0,    // peligroso los dos, con severidad distinta (amarillo↔rojo)
    bothSafe: 0,      // seguro los dos (verde↔poco-viento): no cambia decisiones
  };
}

/** Colapsa el nivel a su clase de decisión: los dos "seguros" son el mismo. */
const decision = (lvl) => (SAFE.has(lvl) ? 'seguro' : lvl);

function addSample(b, s) {
  b.n++;
  b.wind.push(Math.abs(s.predWind - s.obsWind));
  b.windBias.push(s.predWind - s.obsWind);
  b.gust.push(Math.abs(s.predGust - s.obsGust));
  b.gustBias.push(s.predGust - s.obsGust);
  if (s.predWind >= DIR_MIN_WIND && s.obsWind >= DIR_MIN_WIND) b.dir.push(angularDiff(s.predDir, s.obsDir));
  b.rain.push(Math.abs(s.predRain - s.obsRain));
  if (s.predFog != null) {
    b.fog.n++;
    const k = s.predFog ? (s.obsFog ? 'tp' : 'fp') : (s.obsFog ? 'fn' : 'tn');
    b.fog[k]++;
  }
  const sk = s.predSurge ? (s.obsSurge ? 'tp' : 'fp') : (s.obsSurge ? 'fn' : 'tn');
  b.surge[sk]++;
  const pSafe = SAFE.has(s.predLevel), oSafe = SAFE.has(s.obsLevel);
  if (s.predLevel === s.obsLevel) b.levelHits++;
  if (decision(s.predLevel) === decision(s.obsLevel)) b.mergedHits++;
  if (pSafe === oSafe) b.binHits++;
  if (pSafe && !oSafe) b.dangerMiss++;
  else if (!pSafe && oSafe) b.conservative++;
  else if (!pSafe && !oSafe && s.predLevel !== s.obsLevel) b.bothDanger++;
  else if (pSafe && oSafe && s.predLevel !== s.obsLevel) b.bothSafe++;
}

const pct = (num, den) => (den ? `${Math.round(100 * num / den)}%` : '—');

function row(label, b, w) {
  return [
    pad(label, w), padL(b.n, 3),
    padL(`${fx(mean(b.wind))}${biasTag(b.windBias)}`, 11),
    padL(fx(mean(b.gust)), 7),
    padL(b.dir.length ? `${Math.round(mean(b.dir))}°` : '—', 6),
    padL(fx(mean(b.rain)), 7),
    padL(pct(b.binHits, b.n), 8),
    padL(pct(b.levelHits, b.n), 7),
    padL(b.dangerMiss, 5),
  ].join(' ');
}

function biasTag(arr) {
  const m = mean(arr);
  if (m == null) return '';
  const r = Math.round(m * 10) / 10;
  return ` (${r >= 0 ? '+' : ''}${r})`;
}

function header(w) {
  return pad('', w) + ' ' + padL('N', 3) + ' ' + padL('Viento(MAE)', 11) + ' ' +
    padL('Ráfaga', 7) + ' ' + padL('Dir', 6) + ' ' + padL('Lluvia', 7) + ' ' +
    padL('Decisión', 8) + ' ' + padL('Exacto', 7) + ' ' + padL('Pelig', 5);
}

function confusion(label, c, w) {
  const events = c.tp + c.fn;
  const evaluated = c.tp + c.fp + c.fn + c.tn;
  const recall = events ? `${Math.round(100 * c.tp / events)}%` : '—';
  return `  ${pad(label, w)} ${padL(evaluated, 3)} días · obs ${padL(events, 2)} ev · detectó ${padL(c.tp, 2)} (${padL(recall, 4)}) · no detectó ${padL(c.fn, 2)} · falsas alarmas ${padL(c.fp, 2)}`;
}

async function main() {
  const files = (await readdir('validation')).filter((f) => /^forecast-\d{4}-\d{2}-\d{2}-.+\.json$/.test(f)).sort();
  if (!files.length) { console.error('No hay snapshots en validation/.'); process.exit(1); }

  const snaps = [];
  for (const f of files) snaps.push(JSON.parse(await readFile(`validation/${f}`, 'utf8')));

  // Observado por zona: una sola consulta por lugar cubriendo todo el rango.
  const byLoc = new Map();
  for (const s of snaps) {
    const key = s.location.name;
    if (!byLoc.has(key)) byLoc.set(key, { loc: s.location, snaps: [] });
    byLoc.get(key).snaps.push(s);
  }

  const observed = new Map(); // name -> { daysByDate, surge }
  for (const [name, { loc, snaps: ss }] of byLoc) {
    const dates = ss.flatMap((s) => s.days.map((d) => d.date)).filter((d) => d <= today);
    if (!dates.length) continue;
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const back = Math.ceil((Date.now() - new Date(minDate + 'T00:00').getTime()) / 86400000) + 1;
    const hourly = await fetchHourly(loc.lat, loc.lon, { pastDays: Math.min(92, Math.max(1, back)), forecastDays: 1 });
    const { days, surge } = scoreDays(hourly);
    observed.set(name, { daysByDate: new Map(days.map((d) => [d.date, d])), surge });
  }

  // Agregar.
  const byLead = new Map(); // lead -> bucket
  const byZone = new Map(); // name -> bucket
  const global = newBucket();
  let firstDate = '9999', lastDate = '0000', compared = 0;

  for (const s of snaps) {
    const obs = observed.get(s.location.name);
    if (!obs) continue;
    const capDate = dateOf(s.capturedAt);
    for (const p of s.days) {
      if (p.date > today) continue;
      const a = obs.daysByDate.get(p.date);
      if (!a) continue;
      const lead = Math.round((new Date(p.date + 'T00:00') - new Date(capDate + 'T00:00')) / 86400000);
      const sample = {
        predWind: p.metrics.windMedianKt, obsWind: a.metrics.windMedianKt,
        predGust: p.metrics.gustPeakKt, obsGust: a.metrics.gustPeakKt,
        predDir: p.metrics.windDirDominant, obsDir: a.metrics.windDirDominant,
        predRain: p.metrics.precipTotalMm, obsRain: a.metrics.precipTotalMm,
        predFog: fogFlag(p.metrics.visibilityMinM ?? null),
        obsFog: fogFlag(a.metrics.visibilityMinM ?? null) ?? false,
        predSurge: surgeOn(s.surge, p.date), obsSurge: surgeOn(obs.surge, p.date),
        predLevel: p.level, obsLevel: a.level,
      };
      if (!byLead.has(lead)) byLead.set(lead, newBucket());
      if (!byZone.has(s.location.name)) byZone.set(s.location.name, newBucket());
      addSample(byLead.get(lead), sample);
      addSample(byZone.get(s.location.name), sample);
      addSample(global, sample);
      compared++;
      if (p.date < firstDate) firstDate = p.date;
      if (p.date > lastDate) lastDate = p.date;
    }
  }

  // Salida.
  const W = 13;
  console.log('\n══════════════ VALIDACIÓN DEL PRONÓSTICO ══════════════');
  console.log(`Snapshots: ${snaps.length} · Zonas: ${byZone.size} · Comparaciones día-zona: ${compared}`);
  console.log(`Ventana evaluada: ${firstDate} → ${lastDate} (hoy ${today})`);
  console.log('Observado: reanálisis Open-Meteo (best-estimate, no estación física).');
  console.log('Marea meteorológica = sudestada/bajante detectada por viento. Niebla = visibilidad ≤4 km.');
  if (!compared) { console.log('\n(No hay días ya transcurridos para comparar todavía.)'); return; }

  console.log('\n───── Error por HORIZONTE de pronóstico (todas las zonas) ─────');
  console.log(header(W));
  for (const lead of [...byLead.keys()].sort((a, b) => a - b)) {
    console.log(row(lead === 0 ? '+0 (hoy)' : `+${lead} días`, byLead.get(lead), W));
  }
  console.log('  Viento/Ráfaga = MAE en kt (sesgo pron−real entre paréntesis). Dir = error angular medio.');

  console.log('\n───── Error por ZONA (todos los horizontes) ─────');
  console.log(header(W));
  for (const name of [...byZone.keys()].sort()) console.log(row(name, byZone.get(name), W));

  console.log('\n───── Niebla (visibilidad ≤4 km) ─────');
  if (global.fog.n) console.log(confusion('global', global.fog, 8));
  else console.log('  Sin datos de visibilidad en los snapshots (capturas viejas). Los nuevos sí la guardan.');

  console.log('\n───── Sudestada / bajante (marea meteorológica) ─────');
  console.log(confusion('global', global.surge, 8));

  console.log('\n───── Nivel del semáforo (global) ─────');
  const g = global, errs = g.n - g.levelHits;
  console.log(`  Decisión  (seguro vs peligroso) : ${padL(g.binHits, 3)}/${g.n} (${pct(g.binHits, g.n)})   ← la que importa para salir`);
  console.log(`  Severidad (verde+poco-viento=1) : ${padL(g.mergedHits, 3)}/${g.n} (${pct(g.mergedHits, g.n)})`);
  console.log(`  Exacto    (las 4 clases)        : ${padL(g.levelHits, 3)}/${g.n} (${pct(g.levelHits, g.n)})   ← el más duro: es un max sobre 5 umbrales`);
  console.log(`\n  Anatomía de los ${errs} desaciertos de etiqueta:`);
  console.log(`    PELIGROSO   dijo seguro, salió peligroso    : ${padL(g.dangerMiss, 3)} (${pct(g.dangerMiss, errs)})  ← el error caro`);
  console.log(`    severidad   peligroso ambos (amarillo↔rojo) : ${padL(g.bothDanger, 3)} (${pct(g.bothDanger, errs)})`);
  console.log(`    conservador avisó peligro, salió seguro     : ${padL(g.conservative, 3)} (${pct(g.conservative, errs)})`);
  console.log(`    inocuo      seguro ambos (verde↔poco-viento): ${padL(g.bothSafe, 3)} (${pct(g.bothSafe, errs)})  ← no cambia ninguna decisión`);

  // Detalle de fallos peligrosos.
  const misses = [];
  for (const s of snaps) {
    const obs = observed.get(s.location.name);
    if (!obs) continue;
    const capDate = dateOf(s.capturedAt);
    for (const p of s.days) {
      if (p.date > today) continue;
      const a = obs.daysByDate.get(p.date);
      if (!a) continue;
      if (SAFE.has(p.level) && DANGER.has(a.level)) {
        const lead = Math.round((new Date(p.date + 'T00:00') - new Date(capDate + 'T00:00')) / 86400000);
        misses.push({ date: p.date, zone: s.location.name, lead, pred: p.level, real: a.level, reasons: a.reasons.join('; ') });
      }
    }
  }
  if (misses.length) {
    console.log('\n───── Detalle de fallos peligrosos ─────');
    misses.sort((a, b) => a.date.localeCompare(b.date) || a.zone.localeCompare(b.zone));
    for (const m of misses) {
      console.log(`  ${m.date} ${pad(m.zone, W)} (+${m.lead}d)  ${m.pred} → ${m.real}  · ${m.reasons}`);
    }
  }
  console.log('');
}

main();
