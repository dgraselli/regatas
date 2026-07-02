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

  // Mapas de nivel del mar y altura de ola por timestamp para alinear (las grillas
  // marina y de forecast pueden diferir).
  const seaLevelByTime = new Map<string, number | undefined>();
  const waveByTime = new Map<string, number | undefined>();
  const waveDirByTime = new Map<string, number | undefined>();
  const wavePeriodByTime = new Map<string, number | undefined>();
  if (marine?.hourly) {
    marine.hourly.time.forEach((t, i) => {
      seaLevelByTime.set(t, marine.hourly.sea_level_height_msl?.[i] ?? undefined);
      waveByTime.set(t, marine.hourly.wave_height?.[i] ?? undefined);
      waveDirByTime.set(t, marine.hourly.wave_direction?.[i] ?? undefined);
      wavePeriodByTime.set(t, marine.hourly.wave_period?.[i] ?? undefined);
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
    waveHeightM: waveByTime.get(time),
    waveDir: waveDirByTime.get(time),
    wavePeriodS: wavePeriodByTime.get(time),
  }));
}
