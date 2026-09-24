/**
 * Archivo histórico de viento y marea de la CARP (Comisión Administradora del
 * Río de la Plata). Ops, no forma parte de la app.
 *
 * Son cuatro estaciones del Canal Martín García que MIDEN viento y marea, con
 * serie cada 6 minutos desde 2015, publicadas como ZIP público —sin login— en
 * www.comisionriodelaplata.org/historicos/ y actualizadas a diario ~03:30 UTC.
 *
 * Importa porque hasta ahora no había forma de validar el viento contra dato
 * medido en el agua: los aeropuertos del METAR están todos en tierra, y las
 * series de viento que el INA publica para Pilote Norden son `Simulado` (salida
 * de modelo, escrita con días de anticipación), no medición.
 *
 * Ojo con las otras dos vías del mismo dato, por si alguien las intenta:
 *  - El endpoint en vivo (meteo.comisionriodelaplata.org/ecsCommand.php) exige
 *    sesión y ese host tiene el TLS roto para clientes estrictos: no manda el
 *    certificado intermedio y negocia parámetros que OpenSSL rechaza salvo con
 *    SECLEVEL=0. El navegador lo disimula; curl y probablemente un Worker, no.
 *  - La pestaña "Export" del visor pide usuario y contraseña de la CARP.
 * Por eso acá se usa el archivo histórico, que es el único camino abierto.
 */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const BASE = 'https://www.comisionriodelaplata.org/historicos';
/** Dónde se cachean los ZIP. Va sin trackear: el archivo es re-descargable. */
export const CACHE_DIR = 'validation/.cache/carp';
/** Horas antes de volver a bajar un ZIP (se actualiza 1×/día). */
const CACHE_H = 12;

/**
 * Coordenadas leídas de la capa "Telemetry Layer" del visor de la CARP, no
 * estimadas del mapa: a un par de km de la costa Open-Meteo puede cambiar de
 * celda de grilla y arruinar la comparación.
 *
 * `abierta` distingue la que está en medio del río de las portuarias. Es la
 * comparación que interesa: si el pronóstico se queda corto sólo en la de agua
 * abierta, el sesgo es por la fricción de la costa que el modelo sí resuelve.
 */
export const CARP_STATIONS = [
  { id: 'norden', archivo: 'Norden', nombre: 'Pilote Norden', lat: -34.62865, lon: -57.92503, abierta: true },
  { id: 'colonia', archivo: 'Colonia', nombre: 'Puerto de Colonia', lat: -34.47619, lon: -57.84295, abierta: false },
  { id: 'conchillas', archivo: 'Conchillas', nombre: 'Puerto de Conchillas', lat: -34.22308, lon: -58.07502, abierta: false },
  { id: 'carmelo', archivo: 'Carmelo', nombre: 'Puerto de Carmelo', lat: -34.00696, lon: -58.29661, abierta: false },
];

async function frescoEnCache(ruta) {
  try {
    const s = await stat(ruta);
    return Date.now() - s.mtimeMs < CACHE_H * 3600_000;
  } catch {
    return false;
  }
}

/** Baja (o reusa del caché) el ZIP de una estación. `kind` es 'wind' o 'tide'. */
export async function fetchArchivo(station, kind) {
  await mkdir(CACHE_DIR, { recursive: true });
  const ruta = `${CACHE_DIR}/${station.archivo}_${kind}.zip`;
  if (await frescoEnCache(ruta)) return ruta;

  const url = `${BASE}/${station.archivo}_${kind}.zip`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} devolvió ${res.status}`);
  await writeFile(ruta, Buffer.from(await res.arrayBuffer()));
  return ruta;
}

/**
 * Lee un año del ZIP. Se apoya en `unzip` en vez de descomprimir a mano: es un
 * script de ops y el binario está en cualquier Linux.
 */
export async function leerAnio(zip, station, kind, anio) {
  const miembro = `${station.archivo}_${kind}_${anio}.csv`;
  try {
    const { stdout } = await run('unzip', ['-p', zip, miembro], {
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'latin1',
    });
    return stdout;
  } catch (e) {
    if (/ENOENT/.test(String(e))) throw new Error('Falta el comando `unzip` (apt install unzip).');
    return ''; // el año no está en el ZIP
  }
}

/**
 * CSV de viento → filas { time, kt, dir, gustKt }.
 *
 * Formato: `2026-09-22 20:48:00,3.95,187.8,6.05`. La hora es LOCAL (UTC-3, lo
 * dice la página) y se deja tal cual en el mismo formato naive que usa la app,
 * así se cruza directo con Open-Meteo pedido en esa zona. La velocidad viene en
 * nudos —verificado contra Open-Meteo: el cociente da ~1.2, no ~0.5—.
 */
export function parseViento(csv) {
  const filas = [];
  for (const linea of csv.split('\n')) {
    const p = linea.trim().split(',');
    if (p.length < 4) continue;
    const kt = Number(p[1]);
    const dir = Number(p[2]);
    const gustKt = Number(p[3]);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(p[0]) || !Number.isFinite(kt)) continue;
    filas.push({ time: p[0].slice(0, 16).replace(' ', 'T'), kt, dir, gustKt });
  }
  return filas;
}

/** CSV de marea → filas { time, m }. Altura referida al LIMB, no al cero del INA. */
export function parseMarea(csv) {
  const filas = [];
  for (const linea of csv.split('\n')) {
    const p = linea.trim().split(',');
    if (p.length < 2) continue;
    const m = Number(p[1]);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(p[0]) || !Number.isFinite(m)) continue;
    filas.push({ time: p[0].slice(0, 16).replace(' ', 'T'), m });
  }
  return filas;
}

/** Promedia a hora en punto: la serie viene cada 6 min y el pronóstico es horario. */
export function aHorario(filas, campo) {
  const acc = new Map();
  for (const f of filas) {
    const k = `${f.time.slice(0, 13)}:00`;
    const v = f[campo];
    if (!Number.isFinite(v)) continue;
    const cur = acc.get(k) ?? { suma: 0, n: 0 };
    cur.suma += v;
    cur.n += 1;
    acc.set(k, cur);
  }
  return new Map([...acc].map(([k, { suma, n }]) => [k, suma / n]));
}
