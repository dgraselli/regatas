import type { HourlyPoint } from '@/lib/types/forecast';
import type { WaterLevelObservation } from '@/lib/types/water';
import { parseLocalIso } from '@/lib/format';

/**
 * Ventana de marea: qué nivel hay AHORA y hasta qué hora se mantiene dentro del
 * rango seguro de la amarra.
 *
 * El problema que resuelve: el INA publica el nivel medido con 1 a 2 h de
 * atraso, así que el dato "actual" nunca es actual. Se midió (14 días, 4
 * estaciones del Río de la Plata) cuánto cuesta ese atraso y cuál de las formas
 * de taparlo funciona mejor:
 *
 *   persistencia (usar el dato viejo tal cual)   error medio 0.14-0.18 m
 *   extrapolar la pendiente de las últimas 2 h   0.14-0.19 m, y hasta 1.38 m
 *                                                de error cerca de las paradas
 *   puente (pronóstico reanclado a la medición)  0.14-0.20 m
 *
 * O sea: hay un piso de ~15 cm que ningún método baja, y extrapolar la pendiente
 * es peor justo cuando más importa. Por eso acá NO se intenta adivinar mejor: se
 * usa el puente —que es el único que además permite mirar hacia adelante— y se
 * publica la incertidumbre junto al número, para que la UI pueda admitir que no
 * sabe en vez de dar un veredicto falso.
 *
 * El dato que sí cambia la decisión es el horizonte: estimar el nivel de dentro
 * de 12 h cuesta apenas ~9 cm más de error que estimar el de ahora. Con la misma
 * precisión con que se sabe el presente se puede planificar el día entero.
 */

/**
 * Incertidumbre (m) de la estimación, según cuántas horas hacia adelante mire.
 * Salen del error medio medido: 0.14-0.20 m para el ahora y 0.23-0.35 m a 12 h.
 * Se redondean hacia arriba porque quedarse corto es el error que importa.
 */
export const UNCERTAINTY_NOW_M = 0.2;
export const UNCERTAINTY_12H_M = 0.3;
const HORIZON_H = 12;
/**
 * Horas de pasado que se devuelven por defecto. 24 h muestra las dos últimas
 * mareas completas —el ciclo del Río de la Plata es semidiurno, ~12 h—, que es
 * el contexto mínimo para ver si viene subiendo de días o si es sólo la marea
 * del momento. No se toma toda la serie observada (~80 h) porque entonces las
 * 12 h de pronóstico, que es lo accionable, quedarían aplastadas en un 13 % del
 * ancho.
 */
const PAST_H = 24;
/** Observaciones que se promedian para anclar el pronóstico al cero del mareógrafo. */
const OFFSET_SAMPLES = 3;
/**
 * Dos tramos malos del mismo tipo separados por este hueco (h) se cuentan como
 * uno solo: un respiro de una hora no alcanza para salir, y partir el aviso en
 * dos hace ruido sin agregar información.
 */
const MERGE_GAP_H = 1;

const HOUR_MS = 3_600_000;

export function uncertaintyAt(hoursAhead: number): number {
  const h = Math.max(0, Math.min(HORIZON_H, hoursAhead));
  return UNCERTAINTY_NOW_M + (UNCERTAINTY_12H_M - UNCERTAINTY_NOW_M) * (h / HORIZON_H);
}

/** De dónde sale el número de un punto de la curva. */
export type TideSource =
  /** Medición real del mareógrafo en esa hora. */
  | 'medido'
  /** Pronóstico de nivel del mar reanclado a la última medición. */
  | 'puente'
  /** Última medición arrastrada, porque no hay pronóstico marino para anclar. */
  | 'persistencia';

export interface TidePoint {
  /** Hora en punto ('YYYY-MM-DDTHH:00'), misma zona que el pronóstico. */
  time: string;
  heightM: number;
  /** Margen ±, en metros. Cero solo si el valor es una medición de esa hora. */
  uncertaintyM: number;
  source: TideSource;
}

export type UnsafeKind = 'bajo' | 'alto';

export interface UnsafeSpan {
  kind: UnsafeKind;
  startsAt: string;
  /** null si sigue fuera de rango cuando termina la ventana. */
  endsAt: string | null;
}

export interface TideWindow {
  /** Mejor estimación para la hora actual. */
  now?: TidePoint;
  /** Curva horaria, de `pastH` horas atrás a HORIZON_H adelante. */
  points: TidePoint[];
  /**
   * Tramos de acá en adelante en que el nivel queda fuera del rango seguro.
   * Se calculan con el borde PESIMISTA de la banda: un tramo entra en la lista
   * apenas la incertidumbre toca el umbral, no cuando el valor central lo cruza.
   * Para "¿puedo salir sin varar?" conviene errar hacia salir antes.
   */
  unsafe: UnsafeSpan[];
  /** Diferencia (m) entre el cero del mareógrafo y el MSL del pronóstico. */
  offsetM: number | null;
}

const EMPTY: TideWindow = { points: [], unsafe: [], offsetM: null };

/** Timestamp naive → clave de la hora más cercana ('YYYY-MM-DDTHH:00'). */
function hourKey(iso: string): string | null {
  const ms = parseLocalIso(iso);
  if (ms == null) return null;
  return `${new Date(Math.round(ms / HOUR_MS) * HOUR_MS).toISOString().slice(0, 13)}:00`;
}

function shiftHours(key: string, hours: number): string {
  const ms = parseLocalIso(key);
  return `${new Date(ms! + hours * HOUR_MS).toISOString().slice(0, 13)}:00`;
}

/**
 * @param observations Nivel medido por el INA (orden cronológico, hora local).
 * @param hourly Pronóstico horario; se usa `seaLevelM` (Open-Meteo Marine, MSL).
 * @param now Hora actual naive en la zona del lugar, como la da `nowInTz`.
 */
export function buildTideWindow(
  observations: WaterLevelObservation[],
  hourly: HourlyPoint[],
  now: string,
  opts: { safeMinM?: number; safeMaxM?: number; pastH?: number } = {},
): TideWindow {
  const pastH = opts.pastH ?? PAST_H;
  const nowHour = hourKey(now);
  if (!nowHour || observations.length === 0) return EMPTY;

  const obsByHour = new Map<string, number>();
  for (const o of observations) {
    const k = hourKey(o.time);
    if (k) obsByHour.set(k, o.heightM);
  }
  if (obsByHour.size === 0) return EMPTY;

  const fcByHour = new Map<string, number>();
  for (const p of hourly) {
    const k = hourKey(p.time);
    if (k && p.seaLevelM != null) fcByHour.set(k, p.seaLevelM);
  }

  // El pronóstico viene referido al MSL y el mareógrafo a su cero propio: la
  // diferencia es de ~0.9 m y además se corre con la bajante del río, así que no
  // sirve una constante. Se reancla con las últimas mediciones disponibles.
  const anchors = [...obsByHour.keys()].sort().slice(-OFFSET_SAMPLES).filter((k) => fcByHour.has(k));
  const offsetM = anchors.length
    ? anchors.reduce((sum, k) => sum + (obsByHour.get(k)! - fcByHour.get(k)!), 0) / anchors.length
    : null;

  const lastObsHour = [...obsByHour.keys()].sort().at(-1)!;

  const points: TidePoint[] = [];
  for (let h = -pastH; h <= HORIZON_H; h++) {
    const key = shiftHours(nowHour, h);
    const measured = obsByHour.get(key);
    if (measured != null) {
      points.push({ time: key, heightM: measured, uncertaintyM: 0, source: 'medido' });
      continue;
    }
    const fc = fcByHour.get(key);
    if (offsetM != null && fc != null) {
      points.push({
        time: key,
        heightM: fc + offsetM,
        uncertaintyM: uncertaintyAt(h),
        source: 'puente',
      });
    }
  }

  let nowPoint = points.find((p) => p.time === nowHour);
  if (!nowPoint) {
    // Sin dato marino no hay puente: se arrastra la última medición, con la
    // incertidumbre que le corresponde por lo vieja que es.
    const ageH = (parseLocalIso(nowHour)! - parseLocalIso(lastObsHour)!) / HOUR_MS;
    nowPoint = {
      time: nowHour,
      heightM: obsByHour.get(lastObsHour)!,
      uncertaintyM: uncertaintyAt(ageH),
      source: 'persistencia',
    };
  }

  return { now: nowPoint, points, unsafe: unsafeSpans(points, nowHour, opts), offsetM };
}

function unsafeSpans(
  points: TidePoint[],
  nowHour: string,
  { safeMinM, safeMaxM }: { safeMinM?: number; safeMaxM?: number },
): UnsafeSpan[] {
  if (safeMinM == null && safeMaxM == null) return [];
  const ahead = points.filter((p) => p.time >= nowHour);

  const kindOf = (p: TidePoint): UnsafeKind | null => {
    // Borde pesimista: alcanza con que la banda toque el umbral.
    if (safeMinM != null && p.heightM - p.uncertaintyM <= safeMinM) return 'bajo';
    if (safeMaxM != null && p.heightM + p.uncertaintyM >= safeMaxM) return 'alto';
    return null;
  };

  // El tramo en curso es siempre el último de la lista mientras tenga `endsAt`
  // en null; así no hace falta llevarlo aparte y no se puede olvidar de cerrarlo
  // al pasar directo de un tipo al otro (bajo → alto sin nada seguro en medio).
  const spans: UnsafeSpan[] = [];
  const openSpan = () => (spans.at(-1)?.endsAt === null ? spans.at(-1)! : null);

  for (const p of ahead) {
    const kind = kindOf(p);
    const open = openSpan();
    if (kind === open?.kind) continue; // sigue igual (o sigue seguro): nada que hacer
    if (open) open.endsAt = p.time;
    if (kind) spans.push({ kind, startsAt: p.time, endsAt: null });
  }

  return spans.reduce<UnsafeSpan[]>((acc, span) => {
    const prev = acc.at(-1);
    const gapH =
      prev?.endsAt != null ? (parseLocalIso(span.startsAt)! - parseLocalIso(prev.endsAt)!) / HOUR_MS : Infinity;
    if (prev && prev.kind === span.kind && gapH <= MERGE_GAP_H) {
      prev.endsAt = span.endsAt;
      return acc;
    }
    acc.push(span);
    return acc;
  }, []);
}
