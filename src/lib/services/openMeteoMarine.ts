import { getJson, USE_MOCKS } from '@/lib/services/http';
import { openMeteoMarineSchema, type OpenMeteoMarine } from '@/lib/services/schemas';
import { mockMarine } from '@/mocks/handlers';

const BASE = 'https://marine-api.open-meteo.com/v1/marine';

/**
 * Nivel del mar y altura de ola (pista; la grilla marina es gruesa y no resuelve
 * bien la costa del estuario). Se usa solo para corroborar la heurística de surge.
 * Devuelve null si la API falla, para que el resto del flujo no se rompa.
 */
export async function fetchMarine(
  lat: number,
  lon: number,
  forecastDays = 7,
): Promise<OpenMeteoMarine | null> {
  if (USE_MOCKS) {
    return openMeteoMarineSchema.parse(mockMarine());
  }
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: 'sea_level_height_msl,wave_height,wave_direction,wave_period',
      timezone: 'America/Argentina/Buenos_Aires',
      forecast_days: String(forecastDays),
    });
    const raw = await getJson<unknown>(`${BASE}?${params.toString()}`);
    return openMeteoMarineSchema.parse(raw);
  } catch {
    return null;
  }
}
