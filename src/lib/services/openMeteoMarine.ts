import { getJson, USE_MOCKS } from '@/lib/services/http';
import { openMeteoMarineSchema, type OpenMeteoMarine } from '@/lib/services/schemas';
import { mockMarine } from '@/mocks/handlers';

const BASE = 'https://marine-api.open-meteo.com/v1/marine';

/**
 * Nivel del mar y altura de ola (pista; la grilla marina es gruesa y no resuelve
 * bien la costa del estuario). Trae 3 días de pasado además del pronóstico.
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
      // Pasado para anclar el nivel de la amarra al mareógrafo (ver mooringLevel.ts):
      // el SHN da ~3 días de mediciones y hay que solaparlas con el modelo.
      past_days: '3',
    });
    const raw = await getJson<unknown>(`${BASE}?${params.toString()}`);
    return openMeteoMarineSchema.parse(raw);
  } catch {
    return null;
  }
}
