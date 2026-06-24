import type { HourlyPoint } from '@/lib/types/forecast';
import type { OpenMeteoForecast, OpenMeteoMarine } from '@/lib/services/schemas';

/**
 * Combina la respuesta de Open-Meteo Forecast (viento/clima) con la de Marine
 * (nivel del mar opcional) en una serie horaria de dominio.
 * El viento se pide en nudos (wind_speed_unit=kn), por lo que no se convierte.
 */
export function normalizeForecast(
  forecast: OpenMeteoForecast,
  marine?: OpenMeteoMarine | null,
): HourlyPoint[] {
  const h = forecast.hourly;

  // Mapa de nivel del mar por timestamp para alinear (las grillas pueden diferir).
  const seaLevelByTime = new Map<string, number | undefined>();
  if (marine?.hourly.sea_level_height_msl) {
    marine.hourly.time.forEach((t, i) => {
      const v = marine.hourly.sea_level_height_msl?.[i];
      seaLevelByTime.set(t, v ?? undefined);
    });
  }

  return h.time.map((time, i) => ({
    time,
    windKt: h.wind_speed_10m[i],
    gustKt: h.wind_gusts_10m[i],
    windDir: h.wind_direction_10m[i],
    precipMm: h.precipitation[i],
    tempC: h.temperature_2m[i],
    visibilityM: h.visibility?.[i] ?? undefined,
    cloudCoverPct: h.cloud_cover?.[i] ?? undefined,
    seaLevelM: seaLevelByTime.get(time),
  }));
}
