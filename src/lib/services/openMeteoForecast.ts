import { getJson, USE_MOCKS } from '@/lib/services/http';
import { openMeteoForecastSchema, type OpenMeteoForecast } from '@/lib/services/schemas';
import { mockForecast } from '@/mocks/handlers';

const BASE = 'https://api.open-meteo.com/v1/forecast';

export async function fetchForecast(
  lat: number,
  lon: number,
  forecastDays = 7,
): Promise<OpenMeteoForecast> {
  if (USE_MOCKS) {
    return openMeteoForecastSchema.parse(mockForecast(lat, lon));
  }
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly:
      'temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility',
    wind_speed_unit: 'kn',
    timezone: 'America/Argentina/Buenos_Aires',
    forecast_days: String(forecastDays),
  });
  const raw = await getJson<unknown>(`${BASE}?${params.toString()}`);
  return openMeteoForecastSchema.parse(raw);
}
