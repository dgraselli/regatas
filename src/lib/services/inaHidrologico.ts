import { formatInTimeZone } from 'date-fns-tz';
import { getJson, USE_MOCKS } from '@/lib/services/http';
import {
  inaObservacionesSchema,
  waterLevelSchema,
  type WaterLevelResponse,
} from '@/lib/services/schemas';
import { mockWaterLevel } from '@/mocks/handlers';
import { TIMEZONE } from '@/lib/profile/defaults';

/**
 * Nivel de agua observado del INA — Sistema de Alerta Hidrológico (API pública
 * "a5"). Se consulta la serie de "Altura hidrométrica" (metros) de la estación
 * más cercana al lugar activo; ver `src/lib/config/inaStations.ts`.
 *
 * Con NEXT_PUBLIC_USE_MOCKS=true (dev/CI) o sin estación, devuelve el ejemplo.
 */
const BASE = 'https://alerta.ina.gob.ar/a5/obs/puntual/series';

const dayWindow = (days: number) => {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
};

export async function fetchWaterLevel(
  seriesId?: number,
  stationName = 'INA',
): Promise<WaterLevelResponse> {
  if (USE_MOCKS || seriesId == null) {
    return waterLevelSchema.parse(mockWaterLevel());
  }

  const { start, end } = dayWindow(3);
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
