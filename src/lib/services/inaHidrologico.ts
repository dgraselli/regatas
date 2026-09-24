import { formatInTimeZone } from 'date-fns-tz';
import { getJson, getText, USE_MOCKS } from '@/lib/services/http';
import { parseShnCsv } from '@/lib/domain/shn';
import {
  inaObservacionesSchema,
  waterLevelSchema,
  type WaterLevelResponse,
} from '@/lib/services/schemas';
import { mockWaterLevel } from '@/mocks/handlers';
import { TIMEZONE } from '@/lib/profile/defaults';

/**
 * Nivel de agua observado de la estación más cercana al lugar activo (ver
 * `src/lib/config/inaStations.ts`).
 *
 * Fuente principal: el CSV de alturas horarias del SHN, vía el Worker propio
 * (el SHN no trae CORS). Son los mismos mareógrafos que republica el INA, pero
 * el SHN los publica minutos después de medir y el INA con 1 a 2 h de atraso:
 * con la marea moviéndose 5–8 cm/h, esa diferencia se ve en el número.
 * Respaldo: la API "a5" del INA — Sistema de Alerta Hidrológico, serie de
 * "Altura hidrométrica" (metros).
 *
 * Con NEXT_PUBLIC_USE_MOCKS=true (dev/CI) o sin estación, devuelve el ejemplo.
 */
const BASE = 'https://alerta.ina.gob.ar/a5/obs/puntual/series';
const SHN_API = process.env.NEXT_PUBLIC_SHN_API ?? 'https://api.regatas.com.ar/shn/alturas';
/** Días de historia que se piden/conservan (el SHN trae ~12; el INA se pide así). */
const HISTORY_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ventana de consulta del endpoint a5, en fechas sin hora.
 *
 * El INA interpreta una fecha pelada como MEDIANOCHE (hora argentina), así que
 * pedir `timeend=hoy` recorta todo el día en curso: la app mostraba el último
 * nivel de anoche y parecía que la estación llevaba medio día sin reportar. Por
 * eso el fin va a mañana, no a hoy.
 */
export const dayWindow = (days: number, now: number = Date.now()) => {
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { start: iso(now - days * DAY_MS), end: iso(now + DAY_MS) };
};

export async function fetchWaterLevel(
  seriesId?: number,
  stationName = 'INA',
): Promise<WaterLevelResponse> {
  if (USE_MOCKS || seriesId == null) {
    return waterLevelSchema.parse(mockWaterLevel());
  }

  const { start, end } = dayWindow(HISTORY_DAYS);
  try {
    const series = parseShnCsv(await getText(SHN_API, { timeoutMs: 6_000 }), stationName).filter((o) => o.time >= start);
    if (series.length) {
      return waterLevelSchema.parse({ stationName: `${stationName} (SHN)`, series });
    }
  } catch {
    /* Worker caído o SHN sin responder: se cae al INA. */
  }

  const raw = await getJson<unknown>(
    `${BASE}/${seriesId}/observaciones?timestart=${start}&timeend=${end}`,
  );
  // El endpoint puede devolver un array plano o { rows: [...] }.
  const rows = inaObservacionesSchema.parse(
    Array.isArray(raw) ? raw : ((raw as { rows?: unknown }).rows ?? []),
  );

  const series = rows
    .filter((r): r is { timestart: string; valor: number } => r.valor != null)
    // Los timestamps vienen en UTC; se pasan a hora local (ISO naive) para la UI.
    .map((r) => ({
      time: formatInTimeZone(new Date(r.timestart), TIMEZONE, "yyyy-MM-dd'T'HH:mm"),
      heightM: r.valor,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  return waterLevelSchema.parse({ stationName: `${stationName} (INA)`, series });
}
