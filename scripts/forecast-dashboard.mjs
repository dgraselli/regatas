#!/usr/bin/env node
/**
 * Dashboard HTML de validación del pronóstico (ops, no parte de la app).
 *
 *   node scripts/forecast-dashboard.mjs
 *   -> genera validation/dashboard.html (autocontenido; abrir en el navegador)
 *
 * Muestra el % de aciertos por horizonte (+0..+N días) para cada dimensión del
 * pronóstico (viento, ráfagas, dirección, lluvia, niebla, marea meteorológica,
 * nivel del semáforo), con 3 secciones: resumen general, desglose por tipo de
 * pronóstico y desglose por lugar. Tema claro con toggle día/noche.
 *
 * "Acierto" por dimensión (umbrales, también listados en el HTML):
 *   - viento mediano:  |pron−real| ≤ 2 kt
 *   - ráfagas (pico):  |pron−real| ≤ 3 kt
 *   - dirección:       error angular ≤ 30° (solo días con viento ≥5 kt)
 *   - lluvia:          misma categoría (seco / algo ≥2mm / fuerte ≥12mm)
 *   - niebla:          coincide sí/no (visibilidad ≤4 km)
 *   - marea meteo:     coincide sí/no (sudestada/bajante por viento)
 *   - semáforo:        tres varas — decisión (seguro vs peligroso, la que importa),
 *                      severidad (fusiona verde+poco-viento) y exacto (4 clases)
 *
 * Lluvia/niebla/marea son dimensiones de EVENTO RARO: si en el período no hubo
 * eventos observados, el % de acierto es trivial (acertar "no pasa nada"), así que
 * se muestra "sin eventos" en gris en vez de un 100% engañoso.
 *
 * Observado = reanálisis ERA5 vía Open-Meteo (asimila estaciones/satélites; no es
 * una estación física puntual, pero sí es independiente del pronóstico evaluado).
 * Dominio compartido: scripts/lib/forecast-domain.mjs
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import {
  fetchHourly, scoreDays, dateOf, angularDiff, SCORING, SAFE, DANGER,
} from './lib/forecast-domain.mjs';

const OUT_DIR = 'public/validacion';
const OUT_FILE = `${OUT_DIR}/index.html`;
const TZ = 'America/Argentina/Buenos_Aires';
const FOG_M = SCORING.fogYellowM;
const DIR_MIN_WIND = 5;
const WIND_OK = 2, GUST_OK = 3, DIR_OK = 30;
const today = dateOf(new Date().toLocaleString('sv', { timeZone: TZ }).replace(' ', 'T'));

const rainCat = (mm) => (mm >= SCORING.rainRed ? 'fuerte' : mm >= SCORING.rainYellow ? 'algo' : 'seco');
const fogFlag = (v) => (v == null ? null : v <= FOG_M);
const surgeOn = (alerts, date) => (alerts ?? []).some((a) => dateOf(a.startsAt) <= date && dateOf(a.endsAt) >= date);

const DIMS = [
  { key: 'viento', label: 'Viento (fuerza)', desc: 'Acierto: |pron−real| ≤ 2 kt (viento mediano del día).' },
  { key: 'rafaga', label: 'Ráfagas', desc: 'Acierto: |pron−real| ≤ 3 kt (pico del día).' },
  { key: 'direccion', label: 'Dirección', desc: 'Acierto: error angular ≤ 30° (solo días con viento ≥5 kt).' },
  { key: 'lluvia', label: 'Lluvia', eventBased: true, desc: 'Acierto: misma categoría (seco / algo ≥2 mm / fuerte ≥12 mm). Evento = día con lluvia.' },
  { key: 'niebla', label: 'Niebla', eventBased: true, desc: 'Acierto: coincide sí/no (visibilidad ≤4 km). Evento = día con niebla. Solo snapshots con visibilidad.' },
  { key: 'marea', label: 'Marea meteorológica', eventBased: true, desc: 'Acierto: coincide sí/no de sudestada/bajante (por viento). Evento = día con sudestada/bajante.' },
  // El semáforo se mide con tres varas, de la más útil a la más dura. Una sola engaña:
  // el nivel es un `max` sobre 5 umbrales, y `poco-viento` no es una severidad sino
  // una anotación para vela (verde↔poco-viento no cambia ninguna decisión).
  { key: 'decision', label: 'Semáforo — decisión', desc: 'Acierto: coincide SEGURO (verde/poco-viento) vs PELIGROSO (amarillo/rojo). Es la pregunta real: ¿salgo o no?' },
  { key: 'severidad', label: 'Semáforo — severidad', desc: 'Acierto: nivel exacto fusionando verde y poco-viento en "seguro" (distingue amarillo de rojo).' },
  { key: 'nivel', label: 'Semáforo — exacto', desc: 'Acierto: las 4 clases exactas (verde / poco-viento / amarillo / rojo). La vara más dura: es un max sobre 5 umbrales.' },
];

/** Colapsa el nivel a su clase de decisión: los dos "seguros" son el mismo. */
const decisionOf = (lvl) => (SAFE.has(lvl) ? 'seguro' : lvl);

/**
 * Devuelve, por dimensión, { hit, ev }: hit = true/false/null (no aplica);
 * ev = true si el caso OBSERVADO fue un evento (solo dims de evento raro), si no null.
 */
function judge(s) {
  return {
    viento: { hit: Math.abs(s.predWind - s.obsWind) <= WIND_OK, ev: null },
    rafaga: { hit: Math.abs(s.predGust - s.obsGust) <= GUST_OK, ev: null },
    direccion: { hit: (s.predWind >= DIR_MIN_WIND && s.obsWind >= DIR_MIN_WIND) ? angularDiff(s.predDir, s.obsDir) <= DIR_OK : null, ev: null },
    lluvia: { hit: rainCat(s.predRain) === rainCat(s.obsRain), ev: rainCat(s.obsRain) !== 'seco' },
    niebla: { hit: s.predFog == null ? null : s.predFog === s.obsFog, ev: s.predFog == null ? null : s.obsFog },
    marea: { hit: s.predSurge === s.obsSurge, ev: s.obsSurge },
    decision: { hit: SAFE.has(s.predLevel) === SAFE.has(s.obsLevel), ev: null },
    severidad: { hit: decisionOf(s.predLevel) === decisionOf(s.obsLevel), ev: null },
    nivel: { hit: s.predLevel === s.obsLevel, ev: null },
  };
}

function add(map, key, j) {
  if (j.hit == null) return;
  if (!map[key]) map[key] = { hits: 0, n: 0, events: 0 };
  map[key].n++;
  if (j.hit) map[key].hits++;
  if (j.ev) map[key].events++;
}
const pct = (o) => (o && o.n ? Math.round((100 * o.hits) / o.n) : null);

async function main() {
  const files = (await readdir('validation')).filter((f) => /^forecast-\d{4}-\d{2}-\d{2}-.+\.json$/.test(f)).sort();
  if (!files.length) { console.error('No hay snapshots en validation/.'); process.exit(1); }
  const snaps = [];
  for (const f of files) snaps.push(JSON.parse(await readFile(`validation/${f}`, 'utf8')));

  // Observado por zona (una consulta por lugar).
  const byLoc = new Map();
  for (const s of snaps) {
    const k = s.location.name;
    if (!byLoc.has(k)) byLoc.set(k, { loc: s.location, snaps: [] });
    byLoc.get(k).snaps.push(s);
  }
  const observed = new Map();
  for (const [name, { loc, snaps: ss }] of byLoc) {
    const dates = ss.flatMap((s) => s.days.map((d) => d.date)).filter((d) => d <= today);
    if (!dates.length) continue;
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const back = Math.ceil((Date.now() - new Date(minDate + 'T00:00').getTime()) / 86400000) + 1;
    const hourly = await fetchHourly(loc.lat, loc.lon, { pastDays: Math.min(92, Math.max(1, back)), forecastDays: 1 });
    const { days, surge } = scoreDays(hourly);
    observed.set(name, { daysByDate: new Map(days.map((d) => [d.date, d])), surge });
  }

  // Agregación: por dimensión × horizonte, por dimensión × zona, global.
  const byLead = {};   // dim -> lead -> {hits,n}
  const byZone = {};   // dim -> zone -> {hits,n}
  const overall = {};  // dim -> {hits,n}
  const leads = new Set();
  const zones = new Set();
  let compared = 0, firstDate = '9999', lastDate = '0000';

  for (const s of snaps) {
    const obs = observed.get(s.location.name);
    if (!obs) continue;
    const zone = s.location.name; zones.add(zone);
    const capDate = dateOf(s.capturedAt);
    for (const p of s.days) {
      if (p.date > today) continue;
      const a = obs.daysByDate.get(p.date);
      if (!a) continue;
      const lead = Math.round((new Date(p.date + 'T00:00') - new Date(capDate + 'T00:00')) / 86400000);
      leads.add(lead);
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
      const v = judge(sample);
      for (const d of DIMS) {
        byLead[d.key] ??= {}; byZone[d.key] ??= {};
        add(byLead[d.key], lead, v[d.key]);
        add(byZone[d.key], zone, v[d.key]);
        add(overall, d.key, v[d.key]);
      }
      compared++;
      if (p.date < firstDate) firstDate = p.date;
      if (p.date > lastDate) lastDate = p.date;
    }
  }

  const leadList = [...leads].sort((a, b) => a - b);
  const zoneList = [...zones].sort();
  const toPct = (m) => Object.fromEntries(Object.entries(m).map(([k, o]) => [k, { hits: o.hits, n: o.n, events: o.events, pct: pct(o) }]));
  const data = {
    meta: {
      snapshots: snaps.length, zones: zoneList.length, compared,
      firstDate, lastDate, today, generatedAt: new Date().toISOString(),
      leads: leadList, zoneList, dims: DIMS,
      thresholds: {
        WIND_OK, GUST_OK, DIR_OK, DIR_MIN_WIND, FOG_M,
        rainYellow: SCORING.rainYellow, rainRed: SCORING.rainRed,
        // Umbrales del semáforo, para que la sección "cómo se calcula" no se desfase del código.
        strongWind: SCORING.strongWind, dangerWind: SCORING.dangerWind,
        gustYellow: SCORING.gustYellow, gustRed: SCORING.gustRed,
        idealWindMin: SCORING.idealWindMin, fogRedM: SCORING.fogRedM,
      },
    },
    overall: toPct(overall),
    byLead: Object.fromEntries(DIMS.map((d) => [d.key, toPct(byLead[d.key] ?? {})])),
    byZone: Object.fromEntries(DIMS.map((d) => [d.key, toPct(byZone[d.key] ?? {})])),
  };

  // Se escribe dentro de public/ para que `npm run build` lo copie a out/ y quede
  // publicado en https://regatas.com.ar/validacion/ (Next copia public/ tal cual).
  // Es un archivo estático suelto: no pasa por Next ni por React.
  const html = renderHtml(data);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, html);
  console.log(`Dashboard generado: ${OUT_FILE}`);
  console.log(`Snapshots ${data.meta.snapshots} · zonas ${data.meta.zones} · comparaciones ${compared} · ${firstDate}→${lastDate}`);
  console.log(`Abrir con:  xdg-open ${OUT_FILE}`);
  console.log('Para publicarlo en regatas.com.ar/validacion hay que commitear ese archivo y pushear.');
}

function renderHtml(data) {
  const t = data.meta.thresholds; // los umbrales salen del código, no se escriben a mano acá
  return `<!doctype html>
<html lang="es" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Página de ops, no de producto: se publica para poder consultarla, pero no debe
     competir en buscadores con la app ni confundir a quien busca "regatas". -->
<meta name="robots" content="noindex, nofollow">
<title>Validación del pronóstico — Regatas</title>
<style>
:root{
  --bg:#f6f8fb; --panel:#ffffff; --ink:#0f1c2e; --muted:#5b6b7f; --line:#e4e9f0;
  --accent:#1565c0; --shadow:0 1px 3px rgba(16,32,54,.08),0 8px 24px rgba(16,32,54,.06);
  --na:#cdd5df;
}
[data-theme="dark"]{
  --bg:#0d1521; --panel:#16202e; --ink:#e8eef6; --muted:#9aa9bd; --line:#243243;
  --accent:#64b5f6; --shadow:0 1px 3px rgba(0,0,0,.4); --na:#37465a;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1100px;margin:0 auto;padding:24px 20px 64px}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:8px}
h1{font-size:24px;margin:0 0 4px}
h2{font-size:18px;margin:36px 0 14px;display:flex;align-items:center;gap:8px}
h3{font-size:15px;margin:0 0 8px}
.sub{color:var(--muted);font-size:13px}
.meta{color:var(--muted);font-size:13px;margin-top:6px}
.toggle{cursor:pointer;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:8px 14px;font-size:14px;box-shadow:var(--shadow)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:8px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow)}
.card .lab{font-size:13px;color:var(--muted)}
.card .big{font-size:28px;font-weight:700;margin-top:4px}
.card .n{font-size:12px;color:var(--muted);margin-top:2px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:var(--shadow);margin-top:14px}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:8px 10px;text-align:center;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-weight:600}
td.lab,th.lab{text-align:left;font-weight:600;white-space:nowrap}
.cell{border-radius:8px;color:#0f1c2e;font-weight:700;display:inline-block;min-width:44px;padding:4px 0}
.cell small{font-weight:500;opacity:.7}
.bars{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.barrow{display:grid;grid-template-columns:78px 1fr 84px;align-items:center;gap:10px}
.track{display:block;background:var(--line);border-radius:999px;height:14px;overflow:hidden}
.fill{display:block;height:100%;border-radius:999px;min-width:2px}
.barrow .v{font-variant-numeric:tabular-nums;font-size:13px;color:var(--muted);text-align:right}
.desc{color:var(--muted);font-size:12.5px;margin:2px 0 0}
.legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:12px;margin-top:10px}
.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px}
footer{color:var(--muted);font-size:12px;margin-top:32px}
.na{color:var(--muted)}
details.doc{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);margin-top:12px}
details.doc>summary{cursor:pointer;padding:14px 18px;font-weight:600;list-style:none;display:flex;align-items:center;gap:8px}
details.doc>summary::-webkit-details-marker{display:none}
details.doc>summary::before{content:"▸";color:var(--accent);font-size:13px;transition:transform .15s}
details.doc[open]>summary::before{transform:rotate(90deg)}
details.doc>summary:hover{color:var(--accent)}
.docbody{padding:0 18px 18px;border-top:1px solid var(--line);margin-top:2px;padding-top:14px}
.docbody p{margin:0 0 10px}
.docbody h4{font-size:14px;margin:16px 0 6px}
.docbody h4:first-child{margin-top:0}
.docbody code{background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:1px 5px;font-size:12.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.docbody .formula{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:8px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto}
.docbody table{margin-top:8px}
.docbody td,.docbody th{text-align:left;vertical-align:top;font-size:13px}
.docbody td.k{white-space:nowrap;font-weight:600;width:1%;padding-right:16px}
.docbody .note{color:var(--muted);font-size:12.5px}
.tag{display:inline-block;border-radius:999px;padding:1px 9px;font-size:12px;font-weight:600;white-space:nowrap}
.tag.safe{background:hsl(120 45% 88%);color:hsl(120 60% 22%)}
.tag.dang{background:hsl(8 70% 90%);color:hsl(8 70% 32%)}
[data-theme="dark"] .tag.safe{background:hsl(120 30% 22%);color:hsl(120 50% 78%)}
[data-theme="dark"] .tag.dang{background:hsl(8 40% 26%);color:hsl(8 70% 80%)}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Validación del pronóstico</h1>
      <div class="sub">Río de la Plata · % de aciertos por horizonte de pronóstico · <a href="/" style="color:var(--accent)">volver a la app</a></div>
      <div class="meta" id="meta"></div>
    </div>
    <button class="toggle" id="themeBtn">🌙 Noche</button>
  </header>

  <h2>① Resumen general</h2>
  <div class="cards" id="summaryCards"></div>
  <div class="panel">
    <h3>Aciertos por dimensión y horizonte</h3>
    <div class="desc">Cada celda: % de aciertos. Columnas = días de anticipación del pronóstico.</div>
    <div id="heatmap" style="overflow-x:auto;margin-top:10px"></div>
    <div class="legend">
      <span><i style="background:hsl(120 60% 45%)"></i>≥85%</span>
      <span><i style="background:hsl(80 65% 45%)"></i>70–84%</span>
      <span><i style="background:hsl(45 85% 50%)"></i>50–69%</span>
      <span><i style="background:hsl(8 75% 52%)"></i>&lt;50%</span>
      <span><i style="background:var(--na)"></i>sin datos</span>
    </div>
  </div>

  <h2>② Desglose por tipo de pronóstico</h2>
  <div id="byDim"></div>

  <h2>③ Desglose por lugar</h2>
  <div class="panel">
    <div class="desc">% de aciertos (todos los horizontes juntos) por zona y dimensión.</div>
    <div id="byZone" style="overflow-x:auto;margin-top:10px"></div>
  </div>

  <h2>④ Cómo se calcula cada número</h2>

  <details class="doc">
    <summary>Los tres semáforos: decisión, severidad y exacto</summary>
    <div class="docbody">
      <p>El semáforo de un día no es una medición: es una <strong>etiqueta derivada</strong>. Se
      calcula escalando desde <em>verde</em> con cinco tests de umbral independientes —viento,
      ráfaga, lluvia, niebla y marea meteorológica— y <strong>manda el peor</strong>. Basta que
      uno solo cruce para que cambie la etiqueta entera.</p>
      <p>Por eso medirlo con una sola vara engaña. Las otras dimensiones son el error de
      <em>una</em> variable continua; el semáforo exige acertar <em>cinco clasificaciones a la
      vez</em>, y los errores no se compensan entre sí: al ser un máximo, cualquier dimensión que
      se pase hacia arriba arrastra el resultado. Un 59% de etiqueta exacta es perfectamente
      compatible con un error de viento de 1&nbsp;kt.</p>
      <p>Hay un segundo problema: <code>poco-viento</code> <strong>no es un nivel de peligro</strong>.
      Se aplica solo cuando el día ya era verde y el viento medio queda por debajo de
      ${t.idealWindMin}&nbsp;kt (una anotación útil a vela, irrelevante a motor). Confundir verde
      con poco-viento no cambia ninguna decisión de seguridad, pero la vara exacta lo castiga
      igual que confundir verde con rojo.</p>

      <h4>Las tres varas, de la más útil a la más dura</h4>
      <table>
        <tr>
          <td class="k">Decisión</td>
          <td>Colapsa todo a <span class="tag safe">seguro</span> (verde o poco-viento) vs
          <span class="tag dang">peligroso</span> (amarillo o rojo), y pregunta si coinciden.
          <strong>Es la métrica de producto</strong>: responde la única pregunta que el usuario
          le hace a la app, ¿salgo o no salgo?</td>
        </tr>
        <tr>
          <td class="k">Severidad</td>
          <td>Nivel exacto pero fusionando verde y poco-viento en una sola clase "seguro".
          Sigue distinguiendo amarillo de rojo, así que mide si además de acertar el riesgo
          acierta <em>cuánto</em> riesgo — sin castigar la confusión inocua.</td>
        </tr>
        <tr>
          <td class="k">Exacto</td>
          <td>Igualdad de las cuatro clases (verde / poco-viento / amarillo / rojo), sin crédito
          parcial. La vara más dura y la menos accionable: sirve de diagnóstico interno, no para
          juzgar si la app es confiable.</td>
        </tr>
      </table>
      <p class="note" style="margin-top:12px">Las tres se calculan sobre exactamente las mismas
      comparaciones, así que siempre se ordenan Decisión ≥ Severidad ≥ Exacto. La distancia
      entre ellas es informativa: si Decisión es alta y Exacto baja, el modelo acierta el riesgo
      y falla el matiz — que es un problema mucho menor.</p>

      <h4>El error que importa</h4>
      <p>Ninguno de los tres porcentajes distingue el error caro del barato. Un
      <strong>fallo peligroso</strong> —pronosticó seguro y el día salió peligroso— no es
      comparable a uno conservador —avisó peligro y salió lindo—: el primero te manda al agua,
      el segundo te deja en el club. El desglose completo por tipo de error está en
      <code>node scripts/forecast-report.mjs</code>, que lista día por día cada fallo peligroso
      con su causa.</p>
    </div>
  </details>

  <details class="doc">
    <summary>Cómo se calcula el % de aciertos de cada dimensión</summary>
    <div class="docbody">
      <p>La unidad de medida es la <strong>comparación día-zona</strong>: un día concreto, en un
      lugar concreto, tal como se lo pronosticó en un snapshot, contra lo que después se observó.
      Todos los porcentajes de este panel son lo mismo:</p>
      <div class="formula">% aciertos = comparaciones acertadas ÷ comparaciones evaluadas × 100</div>
      <p>Lo que cambia entre dimensiones es solo <strong>qué cuenta como acertar</strong>:</p>
      <table>
        <tr><td class="k">Viento (fuerza)</td><td>|pronosticado − real| ≤ ${t.WIND_OK}&nbsp;kt, sobre el viento mediano del día.</td></tr>
        <tr><td class="k">Ráfagas</td><td>|pronosticado − real| ≤ ${t.GUST_OK}&nbsp;kt, sobre el pico del día.</td></tr>
        <tr><td class="k">Dirección</td><td>Error angular ≤ ${t.DIR_OK}°. Solo se evalúan los días con viento ≥ ${t.DIR_MIN_WIND}&nbsp;kt: por debajo de eso la dirección es ruido y puntuarla infla el resultado.</td></tr>
        <tr><td class="k">Lluvia</td><td>Misma categoría: seco / algo (≥ ${t.rainYellow}&nbsp;mm) / fuerte (≥ ${t.rainRed}&nbsp;mm). No mide milímetros, mide si clasificó bien el día.</td></tr>
        <tr><td class="k">Niebla</td><td>Coincide el sí/no de visibilidad ≤ ${(t.FOG_M / 1000).toFixed(0)}&nbsp;km. Solo cuenta en snapshots que guardaron visibilidad (los primeros no la tienen).</td></tr>
        <tr><td class="k">Marea meteo.</td><td>Coincide el sí/no de sudestada o bajante detectada por viento.</td></tr>
        <tr><td class="k">Semáforo ×3</td><td>Ver la sección anterior.</td></tr>
      </table>

      <h4>Por qué lluvia, niebla y marea dicen "sin ev."</h4>
      <p>Son <strong>eventos raros</strong>: la enorme mayoría de los días no llueve, no hay niebla
      y no hay sudestada. Un modelo que dijera siempre "no pasa nada" sacaría 90&nbsp;% y sería
      inútil. Por eso, cuando en el período no hubo ningún evento observado, el panel muestra
      <em>sin ev.</em> en gris en vez de un porcentaje trivialmente alto, y cada celda lleva
      abajo el número de eventos reales que la sostienen. Para saber si <em>detecta</em> los
      eventos hay que mirar el recall (detectadas / no detectadas / falsas alarmas) en
      <code>forecast-report.mjs</code>: un 95&nbsp;% de acierto con 3 eventos no dice nada.</p>

      <h4>Contra qué se compara</h4>
      <p>El "observado" es el reanálisis <strong>ERA5</strong> vía Open-Meteo, que asimila
      estaciones y satélites y es <strong>independiente</strong> del pronóstico que se está
      evaluando —no es el pronóstico re-servido—. Su límite: es una grilla de ~9–25&nbsp;km, no una
      estación física en el punto exacto. Para verdad más dura sobre visibilidad está el cruce
      contra METAR de aeropuertos en <code>node scripts/metar-eval.mjs report</code>.</p>

      <h4>Cómo leer los cortes</h4>
      <p>Por <strong>horizonte</strong>: cuántos días antes se hizo ese pronóstico (+0 = el mismo
      día). Es la lectura natural, porque el error crece con la anticipación. Por
      <strong>zona</strong>: junta todos los horizontes. Ojo con la muestra —cada celda se apoya
      en pocas decenas de días, así que diferencias de unos pocos puntos entre zonas u horizontes
      no son señal.</p>
    </div>
  </details>

  <footer id="foot"></footer>
</div>

<script>
const DATA = ${JSON.stringify(data)};

const leadLabel = (l)=> l===0 ? "+0 (hoy)" : "+"+l;
function color(p){
  if(p==null) return "var(--na)";
  if(p>=85) return "hsl(120 60% 45%)";
  if(p>=70) return "hsl(80 65% 45%)";
  if(p>=50) return "hsl(45 85% 50%)";
  return "hsl(8 75% 52%)";
}
const dimByKey = {};
const m = DATA.meta;
m.dims.forEach(d=> dimByKey[d.key]=d);
// Dimensión de evento raro sin eventos observados => % trivial (acertar "no pasa nada").
const trivial = (key,o)=> dimByKey[key] && dimByKey[key].eventBased && o && o.pct!=null && o.events===0;

function cell(key,o){
  if(!o || o.pct==null) return '<span class="cell" style="background:var(--na);color:var(--muted)">—</span>';
  if(trivial(key,o)) return '<span class="cell" style="background:var(--na);color:var(--muted)" title="No hubo eventos observados; el % es trivial">sin ev.<br><small>0 ev</small></span>';
  const ev = dimByKey[key] && dimByKey[key].eventBased ? '<br><small>'+o.events+' ev</small>' : '<br><small>'+o.hits+'/'+o.n+'</small>';
  return '<span class="cell" style="background:'+color(o.pct)+'">'+o.pct+'%'+ev+'</span>';
}

// Meta
document.getElementById('meta').innerHTML =
  'Snapshots: '+m.snapshots+' · Zonas: '+m.zones+' · Comparaciones día-zona: '+m.compared+
  ' · Ventana '+m.firstDate+' → '+m.lastDate+' (hoy '+m.today+')<br>'+
  'Observado: reanálisis ERA5 vía Open-Meteo (independiente del pronóstico; asimila estaciones/satélites).';

// Resumen: tarjetas
const sc = document.getElementById('summaryCards');
sc.innerHTML = m.dims.map(d=>{
  const o = DATA.overall[d.key] || {pct:null,hits:0,n:0,events:0};
  if(trivial(d.key,o)) return '<div class="card"><div class="lab">'+d.label+'</div>'+
    '<div class="big" style="color:var(--muted)">sin ev.</div><div class="n">0 eventos en el período</div></div>';
  const c = color(o.pct);
  const sub = d.eventBased ? o.events+' eventos · '+o.hits+'/'+o.n : o.hits+'/'+o.n+' días';
  return '<div class="card"><div class="lab">'+d.label+'</div>'+
    '<div class="big" style="color:'+(o.pct==null?'var(--muted)':c)+'">'+(o.pct==null?'—':o.pct+'%')+'</div>'+
    '<div class="n">'+sub+'</div></div>';
}).join('');

// Heatmap dimensión × horizonte
let h = '<table><thead><tr><th class="lab">Dimensión</th>';
m.leads.forEach(l=> h += '<th>'+leadLabel(l)+'</th>');
h += '<th>Global</th></tr></thead><tbody>';
m.dims.forEach(d=>{
  h += '<tr><td class="lab">'+d.label+'</td>';
  m.leads.forEach(l=> h += '<td>'+cell(d.key,DATA.byLead[d.key][l])+'</td>');
  h += '<td>'+cell(d.key,DATA.overall[d.key])+'</td></tr>';
});
h += '</tbody></table>';
document.getElementById('heatmap').innerHTML = h;

// Por dimensión: barras por horizonte
document.getElementById('byDim').innerHTML = m.dims.map(d=>{
  const rows = m.leads.map(l=>{
    const o = DATA.byLead[d.key][l];
    const p = o ? o.pct : null;
    const isTriv = trivial(d.key,o);
    const w = (p==null||isTriv)?0:p;
    const val = p==null ? '<span class="na">sin datos</span>'
      : isTriv ? '<span class="na">sin eventos</span>'
      : p+'% <small>('+(d.eventBased?o.events+' ev, ':'')+o.hits+'/'+o.n+')</small>';
    return '<div class="barrow"><span class="lab">'+leadLabel(l)+'</span>'+
      '<span class="track"><span class="fill" style="width:'+w+'%;background:'+(isTriv?'var(--na)':color(p))+'"></span></span>'+
      '<span class="v">'+val+'</span></div>';
  }).join('');
  const o = DATA.overall[d.key]||{pct:null};
  const g = trivial(d.key,o)?'sin eventos':(o.pct==null?'—':o.pct+'%');
  return '<div class="panel"><h3>'+d.label+' — global '+g+'</h3>'+
    '<div class="desc">'+d.desc+'</div><div class="bars">'+rows+'</div></div>';
}).join('');

// Por zona: heatmap zona × dimensión
let z = '<table><thead><tr><th class="lab">Zona</th>';
m.dims.forEach(d=> z += '<th>'+d.label+'</th>');
z += '</tr></thead><tbody>';
m.zoneList.forEach(zn=>{
  z += '<tr><td class="lab">'+zn+'</td>';
  m.dims.forEach(d=> z += '<td>'+cell(d.key,DATA.byZone[d.key][zn])+'</td>');
  z += '</tr>';
});
z += '</tbody></table>';
document.getElementById('byZone').innerHTML = z;

document.getElementById('foot').innerHTML =
  'Generado '+new Date(m.generatedAt).toLocaleString('es-AR')+'.<br>'+
  'Verdad = reanálisis ERA5 (Open-Meteo archive), independiente del pronóstico evaluado; no es una estación física puntual. '+
  'Umbrales de acierto: viento ±'+m.thresholds.WIND_OK+' kt, ráfaga ±'+m.thresholds.GUST_OK+' kt, dirección ≤'+m.thresholds.DIR_OK+'° (viento ≥'+m.thresholds.DIR_MIN_WIND+' kt). '+
  'Lluvia/niebla/marea son eventos raros: si no hubo eventos, el % se marca "sin ev." (acertar "no pasa nada" no mide habilidad). '+
  'Marea meteorológica = sudestada/bajante por viento. Niebla = visibilidad ≤'+(m.thresholds.FOG_M/1000)+' km, solo en snapshots con visibilidad.';

// Tema día/noche
const root = document.documentElement, btn = document.getElementById('themeBtn');
function setTheme(t){ root.dataset.theme=t; btn.textContent = t==='dark'?'☀️ Día':'🌙 Noche'; localStorage.setItem('regatas-theme',t); }
setTheme(localStorage.getItem('regatas-theme') || 'light');
btn.onclick = ()=> setTheme(root.dataset.theme==='dark'?'light':'dark');
</script>
</body>
</html>`;
}

main();
