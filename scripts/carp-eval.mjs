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
 *   node scripts/carp-eval.mjs historico [--estacion norden] [--desde 2016] [--hasta 2026]
 *     -> La misma comparación pero sobre AÑOS, contra el archivo ERA5 de
 *        Open-Meteo. Ojo: ERA5 no es el mismo producto que sirve la app (la API
 *        de pronóstico sólo llega 92 días hacia atrás), así que esto responde
 *        "¿el modelo subestima el viento sobre el río?" y no "¿cuánto se
 *        equivoca el pronóstico que ve el usuario?". Sirve para saber si el
 *        sesgo es estable entre años y estaciones del año, que es lo que falta
 *        para animarse a mover un umbral.
 *
 *   node scripts/carp-eval.mjs referencia [--dias 92] [--estacion norden]
 *     -> Audita el "observado" que usa `forecast-eval.mjs`. Ese validador compara
 *        el pronóstico contra Open-Meteo `past_days`, o sea contra el mismo modelo
 *        evaluándose a sí mismo. Esto cuenta cuántas horas de viento fuerte REAL
 *        esa referencia no registra: si se le escapan, el validador no puede ver
 *        los fallos peligrosos que justamente busca.
 *
 * Cada subcomando guarda su resumen en validation/carp-viento.json (sólo su
 * sección: correr uno no borra lo de los otros). Ese archivo SÍ se versiona —son
 * pocas KB y diffearlo entre corridas es como se va a notar si el sesgo se
 * mueve—; el caché de ZIPs, en cambio, vive en validation/.cache/ y va sin
 * trackear, porque a diferencia de los snapshots del pronóstico se puede volver
 * a bajar siempre.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { CARP_STATIONS, fetchArchivo, leerAnio, parseViento, aHorario } from './lib/carp.mjs';

/**
 * Resumen persistido. Sin esto el resultado se iba con la terminal: los números
 * quedaban sólo en la conversación en que se corrió el script. Son pocas KB y se
 * versionan, así que se pueden diffear entre corridas —que es como se va a notar
 * si el sesgo se mueve— y los puede leer el dashboard sin recalcular nada. El
 * histórico de 11 años son ~40 pedidos a ERA5: no es algo para rehacer seguido.
 */
const RESUMEN = 'validation/carp-viento.json';

/** Escribe una sección sin pisar las otras: cada subcomando actualiza la suya. */
async function guardar(seccion, datos) {
  let previo = {};
  try {
    previo = JSON.parse(await readFile(RESUMEN, 'utf8'));
  } catch {
    /* primera corrida */
  }
  const salida = { ...previo, [seccion]: { corridaEl: new Date().toISOString(), ...datos } };
  await writeFile(RESUMEN, `${JSON.stringify(salida, null, 2)}\n`);
  console.log(`Resumen guardado en ${RESUMEN} (sección "${seccion}").\n`);
}

const deMapa = (m) => Object.fromEntries([...m].map(([k, v]) => [k, { n: v.a.length, medido: media(v.a), modelo: media(v.b), cociente: media(v.a) / media(v.b) }]));

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
const cuantil = (a, p) => {
  const z = [...a].sort((x, y) => x - y);
  return z[Math.floor(p * (z.length - 1))];
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

/** Viento de ERA5 (archivo) para un año calendario completo. */
async function era5(station, anio) {
  const p = new URLSearchParams({
    latitude: String(station.lat),
    longitude: String(station.lon),
    hourly: 'wind_speed_10m',
    wind_speed_unit: 'kn',
    timezone: 'America/Argentina/Buenos_Aires',
    start_date: `${anio}-01-01`,
    // ERA5 tiene ~5 días de latencia: pedir hasta fin del año en curso da 400.
    end_date: [`${anio}-12-31`, new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10)]
      .sort()[0],
  });
  const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${p}`);
  if (!res.ok) throw new Error(`Archivo Open-Meteo devolvió ${res.status} para ${anio}`);
  const d = await res.json();
  const vel = new Map();
  d.hourly.time.forEach((t, i) => {
    if (d.hourly.wind_speed_10m[i] != null) vel.set(t.slice(0, 16), d.hourly.wind_speed_10m[i]);
  });
  return vel;
}

/** Trimestre austral, para ver si el sesgo depende de la época del año. */
const estacionDelAnio = (iso) => {
  const m = Number(iso.slice(5, 7));
  if (m <= 2 || m === 12) return 'verano';
  if (m <= 5) return 'otoño';
  if (m <= 8) return 'invierno';
  return 'primavera';
};

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

  // Se agrupa por intensidad de LAS DOS series a propósito.
  //
  // Agrupar sólo por el valor medido parece mostrar que el sesgo crece con el
  // viento, pero es un espejismo: al quedarse con las horas de medición alta se
  // eligen también las horas en que la medición estuvo alta POR RUIDO, y el
  // cociente se infla. Es regresión a la media, y agrupando por el modelo el
  // efecto se da vuelta. Si el cociente sube en una vista y baja en la otra, el
  // sesgo es plano y lo que se ve es el artefacto. La prueba limpia son los
  // cuantiles, que no condicionan por nada.
  const franjas = [
    ['0-10 kt', (v) => v < 10],
    ['10-18 kt', (v) => v >= 10 && v < 18],
    ['18-25 kt', (v) => v >= 18 && v < 25],
    ['> 25 kt', (v) => v >= 25],
  ];
  const agrupar = (porSerie) =>
    franjas.map(([etiqueta, test]) => {
      const idx = porSerie.map((v, i) => (test(v) ? i : -1)).filter((i) => i >= 0);
      if (idx.length < 10) return { etiqueta, n: idx.length };
      const a = idx.map((i) => A[i]);
      const b = idx.map((i) => B[i]);
      return { etiqueta, n: idx.length, medido: media(a), pronosticado: media(b), cociente: media(a) / media(b) };
    });
  const rangos = agrupar(A);
  const rangosModelo = agrupar(B);
  const cuantiles = [0.5, 0.75, 0.9, 0.95, 0.99].map((q) => ({
    q,
    medido: cuantil(A, q),
    pronosticado: cuantil(B, q),
    cociente: cuantil(A, q) / cuantil(B, q),
  }));

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
    rangosModelo,
    cuantiles,
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

/**
 * Recorre año por año para no tener en memoria una década de serie de 6 minutos.
 * Devuelve el acumulado por franja de intensidad y por estación del año.
 */
async function historico(station, desde, hasta) {
  const zip = await fetchArchivo(station, 'wind');
  const porAnio = [];
  const franjas = new Map(); // etiqueta -> { a: [], b: [] }
  const temporadas = new Map();

  const guardar = (mapa, clave, medido, pronosticado) => {
    const cur = mapa.get(clave) ?? { a: [], b: [] };
    cur.a.push(medido);
    cur.b.push(pronosticado);
    mapa.set(clave, cur);
  };

  for (let anio = desde; anio <= hasta; anio++) {
    const csv = await leerAnio(zip, station, 'wind', anio);
    if (!csv) continue;
    const med = aHorario(parseViento(csv), 'kt');
    if (med.size < 100) continue;
    const ref = await era5(station, anio);
    const horas = [...med.keys()].filter((h) => ref.has(h)).sort();
    if (horas.length < 500) continue;

    const A = horas.map((h) => med.get(h));
    const B = horas.map((h) => ref.get(h));
    porAnio.push({ anio, n: horas.length, medido: media(A), pronosticado: media(B), cociente: media(A) / media(B), r: correlacion(A, B) });

    horas.forEach((h, i) => {
      const v = A[i];
      const franja = v < 10 ? '0-10 kt' : v < 18 ? '10-18 kt' : v < 25 ? '18-25 kt' : '> 25 kt';
      guardar(franjas, franja, v, B[i]);
      guardar(temporadas, estacionDelAnio(h), v, B[i]);
    });
    process.stderr.write(`  …${anio} (${horas.length} h)\n`);
  }
  return { porAnio, franjas, temporadas };
}

async function main() {
  const dias = Number(arg('dias', 60));
  const filtro = arg('estacion', null);
  const estaciones = filtro ? CARP_STATIONS.filter((s) => s.id === filtro) : CARP_STATIONS;
  if (!estaciones.length) {
    console.error(`Estación desconocida. Opciones: ${CARP_STATIONS.map((s) => s.id).join(', ')}`);
    process.exit(1);
  }

  if (process.argv[2] === 'historico') {
    const desde = Number(arg('desde', 2016));
    const hasta = Number(arg('hasta', new Date().getFullYear()));
    const guardadas = [];
    for (const s of estaciones) {
      console.log(`\n${s.nombre} — medido (CARP) vs ERA5, ${desde} a ${hasta}`);
      console.log('(ERA5 no es el producto que sirve la app; mide si el modelo subestima, no el error del pronóstico)\n');
      const { porAnio, franjas, temporadas } = await historico(s, desde, hasta);
      if (!porAnio.length) {
        console.log('  sin años comparables\n');
        continue;
      }
      console.log('  año      horas   medido  ERA5   cociente      r');
      for (const a of porAnio) {
        console.log(`  ${a.anio}   ${String(a.n).padStart(6)}   ${a.medido.toFixed(2).padStart(5)}  ${a.pronosticado.toFixed(2).padStart(5)}    ${a.cociente.toFixed(2)}      ${a.r >= 0 ? '+' : ''}${a.r.toFixed(2)}`);
      }
      const cocientes = porAnio.map((a) => a.cociente);
      console.log(`  → cociente entre ${Math.min(...cocientes).toFixed(2)} y ${Math.max(...cocientes).toFixed(2)} (desvío ${desvio(cocientes).toFixed(3)})`);

      console.log('\n  por intensidad medida (todos los años juntos)');
      for (const etiqueta of ['0-10 kt', '10-18 kt', '18-25 kt', '> 25 kt']) {
        const f = franjas.get(etiqueta);
        if (!f || f.a.length < 50) continue;
        console.log(`    ${etiqueta.padEnd(9)} n=${String(f.a.length).padStart(6)}  medido ${media(f.a).toFixed(1).padStart(5)}  ERA5 ${media(f.b).toFixed(1).padStart(5)}  cociente ${(media(f.a) / media(f.b)).toFixed(2)}`);
      }

      console.log('\n  por estación del año');
      for (const etiqueta of ['verano', 'otoño', 'invierno', 'primavera']) {
        const t = temporadas.get(etiqueta);
        if (!t || t.a.length < 50) continue;
        console.log(`    ${etiqueta.padEnd(9)} n=${String(t.a.length).padStart(6)}  cociente ${(media(t.a) / media(t.b)).toFixed(2)}`);
      }
      console.log();
      guardadas.push({ id: s.id, nombre: s.nombre, abierta: s.abierta, porAnio, franjas: deMapa(franjas), temporadas: deMapa(temporadas) });
    }
    await guardar('historico', { desde, hasta, fuente: 'ERA5 (archive-api.open-meteo.com)', estaciones: guardadas });
    return;
  }

  if (process.argv[2] === 'referencia') {
    console.log(`\nAuditoría del "observado" del validador — últimos ${dias} días\n`);
    const guardadas = [];
    for (const s of estaciones) {
      const r = await auditarReferencia(s, dias);
      if (r) guardadas.push({ id: s.id, nombre: s.nombre, ...r });
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
    await guardar('referencia', { dias, fuente: 'Open-Meteo past_days (lo que usa forecast-eval.mjs)', estaciones: guardadas });
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
    console.log('  cuantiles (sin condicionar: es la vista limpia del sesgo)');
    for (const c of r.cuantiles) {
      console.log(`    p${String(c.q * 100).padStart(2)}  medido ${c.medido.toFixed(1).padStart(5)}  pron. ${c.pronosticado.toFixed(1).padStart(5)}  cociente ${c.cociente.toFixed(2)}`);
    }
    for (const [etiqueta, lista] of [
      ['agrupando por MEDIDO (infla las franjas altas)', r.rangos],
      ['agrupando por MODELO (las desinfla)', r.rangosModelo],
    ]) {
      console.log(`  ${etiqueta}`);
      for (const b of lista) {
        if (b.cociente == null) continue;
        console.log(`    ${b.etiqueta.padEnd(9)} n=${String(b.n).padStart(4)}  medido ${b.medido.toFixed(1)}  pron. ${b.pronosticado.toFixed(1)}  cociente ${b.cociente.toFixed(2)}`);
      }
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

  await guardar('reciente', {
    dias,
    fuente: 'Open-Meteo past_days (el mismo producto que sirve la app)',
    estaciones: ok.map((r) => ({
      id: r.station.id,
      nombre: r.station.nombre,
      abierta: r.station.abierta,
      n: r.n,
      desde: r.desde,
      hasta: r.hasta,
      medido: r.medido,
      pronosticado: r.pronosticado,
      cociente: r.cociente,
      mae: r.mae,
      r: r.r,
      dirMae: r.dirMae,
      dirMediana: r.dirMediana,
      cuantiles: r.cuantiles,
      porMedido: r.rangos,
      porModelo: r.rangosModelo,
    })),
  });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
