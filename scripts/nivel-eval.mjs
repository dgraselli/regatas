#!/usr/bin/env node
/**
 * Nivel de agua OBSERVADO y validación de sudestada/bajante (ops, no parte de la app).
 *
 * El pronóstico de sudestada sale del viento; para saber si se cumplió hace falta
 * lo que pasó con el agua. Esto acumula la serie horaria de los mareógrafos del
 * Río de la Plata y la cruza con las alertas de los snapshots.
 *
 *   node scripts/nivel-eval.mjs capture
 *     -> Baja el CSV de alturas horarias del SHN (~10 días, todas las estaciones)
 *        y acumula en validation/nivel-observado.jsonl. Lo corre a diario
 *        scripts/snapshot-diario.sh. Idempotente: no duplica estación+hora.
 *
 *   node scripts/nivel-eval.mjs backfill [desde=2026-06-20]
 *     -> Rellena el pasado desde la API del INA, que republica los mismos
 *        mareógrafos y guarda la historia completa (el SHN sólo ~10 días).
 *
 *   node scripts/nivel-eval.mjs report
 *     -> Por día: qué alertas pronosticó cada snapshot y cuánto se apartó el
 *        nivel MEDIO del día de lo normal en cada estación.
 *
 * Por qué el nivel medio diario y no el máximo: la marea astronómica del Río de
 * la Plata es semidiurna (~2 ciclos por día), así que el promedio de 24 h la
 * cancela casi entera y lo que queda es la marea meteorológica, que es justo lo
 * que la sudestada/bajante mueve. El máximo del día, en cambio, mezcla las dos.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fetchRetry } from './lib/fetch-retry.mjs';

const OBS_FILE = 'validation/nivel-observado.jsonl';
const SHN_CSV = 'https://www.hidro.gov.ar/oceanografia/AlturasHorarias.asp?export=csv';
const INA_BASE = 'https://alerta.ina.gob.ar/a5/obs/puntual/series';

/** Series "altura hidrométrica" del INA (mismas que src/lib/config/inaStations.ts). */
const INA_SERIES = [
  { seriesId: 3314, station: 'La Plata' },
  { seriesId: 3345, station: 'Pilote Norden' },
  { seriesId: 85, station: 'Buenos Aires' },
  { seriesId: 52, station: 'San Fernando' },
  { seriesId: 3344, station: 'Atalaya' },
];

/** Estaciones que se muestran en el reporte (las del río; el CSV trae también Ushuaia, etc.). */
const REPORT_STATIONS = ['San Fernando', 'Buenos Aires', 'La Plata', 'Pilote Norden', 'Martín García', 'Atalaya'];

/**
 * Anomalía del nivel medio diario (m) a partir de la cual el reporte marca el
 * día. Criterio PROVISORIO, sin calibrar: sirve para que salten a la vista los
 * días raros, no es un umbral oficial de alerta.
 */
const ANOMALY_M = 0.3;
/** Horas mínimas medidas en el día para que su promedio cuente. */
const MIN_HOURS_DAY = 18;

/** ISO UTC → hora local naive 'YYYY-MM-DDTHH:mm' (RdlP, UTC−3 fijo, sin DST). */
const formatLocal = (iso) => new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 16);

// ---------------------------------------------------------------------------

async function loadObs() {
  const txt = await readFile(OBS_FILE, 'utf8').catch(() => '');
  const rows = [];
  for (const line of txt.split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* línea rota: se ignora */ }
  }
  return { txt, rows };
}

/** Agrega filas nuevas (estación+hora no vista) al final del archivo. */
async function appendNew(newRows, source) {
  const { txt, rows } = await loadObs();
  const seen = new Set(rows.map((r) => `${r.station}|${r.time}`));
  const capturedAt = new Date().toISOString();
  const lines = [];
  const perStation = new Map();
  for (const r of newRows.sort((a, b) => a.time.localeCompare(b.time))) {
    const key = `${r.station}|${r.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(JSON.stringify({ capturedAt, source, ...r }));
    perStation.set(r.station, (perStation.get(r.station) ?? 0) + 1);
  }
  for (const [st, n] of perStation) console.log(`  ${st.padEnd(16)} ${String(n).padStart(4)} obs nuevas`);
  if (!lines.length) {
    console.log(`Sin observaciones nuevas. ${OBS_FILE} sin cambios.`);
    return;
  }
  await writeFile(OBS_FILE, txt + lines.join('\n') + '\n');
  console.log(`${lines.length} observaciones nuevas → ${OBS_FILE} (total ${seen.size}).`);
}

/**
 * CSV del SHN: `Fecha y hora;Martín García;San Fernando;...`, filas de la más
 * nueva a la más vieja, hora oficial argentina, "S/D" = sin dato. Viene en
 * Latin-1. Mismo formato que parsea src/lib/domain/shn.ts.
 */
function parseShnCsvAll(csv) {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(';').map((s) => s.trim());
  const out = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(';');
    const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(cells[0]?.trim() ?? '');
    if (!m) continue;
    const [, dd, mm, yyyy, hh, mi] = m;
    const time = `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    for (let c = 1; c < header.length; c++) {
      const raw = cells[c]?.trim().replace(',', '.');
      if (raw && /^-?\d+(\.\d+)?$/.test(raw)) out.push({ time, station: header[c], heightM: Number(raw) });
    }
  }
  return out;
}

async function capture() {
  const res = await fetchRetry(SHN_CSV, { label: 'SHN' });
  if (!res.ok) throw new Error(`SHN HTTP ${res.status}`);
  const csv = new TextDecoder('latin1').decode(await res.arrayBuffer());
  const rows = parseShnCsvAll(csv);
  if (!rows.length) throw new Error('SHN: el CSV no trajo datos (¿cambió el formato?)');
  await appendNew(rows, 'SHN');
}

async function backfill(from = '2026-06-20') {
  const end = new Date(Date.now() + 86400_000).toISOString().slice(0, 10); // el INA corta a medianoche
  const all = [];
  for (const { seriesId, station } of INA_SERIES) {
    const res = await fetchRetry(`${INA_BASE}/${seriesId}/observaciones?timestart=${from}&timeend=${end}`, { label: `INA ${station}` });
    if (!res.ok) throw new Error(`INA ${station} HTTP ${res.status}`);
    const raw = await res.json();
    const rows = Array.isArray(raw) ? raw : (raw.rows ?? []);
    for (const r of rows) {
      if (r.valor == null) continue;
      // Timestamps en UTC → hora local naive, igual que el CSV del SHN.
      all.push({ time: formatLocal(r.timestart), station, heightM: r.valor });
    }
  }
  await appendNew(all, 'INA');
}

// ---------------------------------------------------------------------------

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Nivel medio por estación y día, y su anomalía contra la mediana de los días. */
function dailyAnomalies(rows) {
  const byStDay = new Map(); // station -> date -> [heights]
  for (const r of rows) {
    const d = r.time.slice(0, 10);
    if (!byStDay.has(r.station)) byStDay.set(r.station, new Map());
    const m = byStDay.get(r.station);
    if (!m.has(d)) m.set(d, []);
    m.get(d).push(r.heightM);
  }
  const out = new Map(); // station -> date -> { mean, anomaly }
  for (const [st, days] of byStDay) {
    const means = new Map();
    for (const [d, hs] of days) if (hs.length >= MIN_HOURS_DAY) means.set(d, hs.reduce((a, b) => a + b, 0) / hs.length);
    if (!means.size) continue;
    // La mediana de los promedios diarios es "lo normal" del período. No es un
    // cero absoluto (el río tiene variación estacional), pero en unos meses de
    // serie alcanza para ver qué días se apartaron.
    const base = median([...means.values()]);
    out.set(st, new Map([...means].map(([d, mean]) => [d, { mean, anomaly: mean - base }])));
  }
  return out;
}

/** Alertas de sudestada/bajante de todos los snapshots, por día afectado. */
async function forecastAlerts() {
  const files = (await readdir('validation')).filter((f) => /^forecast-.*\.json$/.test(f));
  const byDay = new Map(); // date -> [{type, zona, cap, sev, kt}]
  for (const f of files) {
    const s = JSON.parse(await readFile(`validation/${f}`, 'utf8'));
    for (const a of s.surge ?? []) {
      for (let t = Date.parse(`${a.startsAt.slice(0, 10)}T00:00Z`); t <= Date.parse(`${a.endsAt.slice(0, 10)}T00:00Z`); t += 86400_000) {
        const d = new Date(t).toISOString().slice(0, 10);
        if (!byDay.has(d)) byDay.set(d, []);
        byDay.get(d).push({ type: a.type, zona: s.location?.name ?? f, cap: s.capturedAt.slice(5, 10), sev: a.severity, kt: a.avgWindKt });
      }
    }
  }
  return byDay;
}

async function report() {
  const { rows } = await loadObs();
  if (!rows.length) { console.log(`No hay datos en ${OBS_FILE}. Correr primero: capture / backfill.`); return; }
  const anom = dailyAnomalies(rows);
  const alerts = await forecastAlerts();
  const stations = REPORT_STATIONS.filter((s) => anom.has(s));
  const allDays = [...new Set([...anom.values()].flatMap((m) => [...m.keys()]))].sort();
  console.log(`Nivel observado: ${rows.length} obs, ${allDays[0]} → ${allDays.at(-1)}`);
  console.log(`Anomalía = nivel medio del día − mediana de los días de la estación (m). Marca ▲/▼ a partir de ±${ANOMALY_M} m (criterio provisorio).\n`);

  // Días que interesan: los que alguna vez tuvieron alerta y los que el agua se apartó.
  const interesting = allDays.filter((d) =>
    alerts.has(d) || stations.some((s) => Math.abs(anom.get(s).get(d)?.anomaly ?? 0) >= ANOMALY_M));
  for (const d of [...alerts.keys()]) if (!interesting.includes(d)) interesting.push(d);
  interesting.sort();

  const short = (s) => s.split(' ').map((w) => w[0]).join('').padStart(3);
  console.log(`fecha       ${stations.map((s) => short(s).padStart(6)).join(' ')}   pronóstico`);
  for (const d of interesting) {
    const cells = stations.map((s) => {
      const a = anom.get(s).get(d)?.anomaly;
      if (a == null) return '   s/d';
      const flag = a >= ANOMALY_M ? '▲' : a <= -ANOMALY_M ? '▼' : ' ';
      return `${a >= 0 ? '+' : ''}${a.toFixed(2)}${flag}`.padStart(6);
    });
    const al = alerts.get(d) ?? [];
    const desc = al.length
      ? [...new Set(al.map((x) => x.type))].map((ty) => {
          const xs = al.filter((x) => x.type === ty);
          return `${ty} en ${[...new Set(xs.map((x) => x.zona))].join('/')} (capturas ${[...new Set(xs.map((x) => x.cap))].sort().join(' ')})`;
        }).join('; ')
      : '—';
    console.log(`${d}  ${cells.join(' ')}   ${desc}`);
  }
  console.log(`\nEstaciones: ${stations.map((s) => `${short(s).trim()}=${s}`).join(', ')}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'capture') await capture();
else if (cmd === 'backfill') await backfill(arg);
else if (cmd === 'report') await report();
else { console.error('Uso: node scripts/nivel-eval.mjs capture | backfill [desde] | report'); process.exit(1); }
