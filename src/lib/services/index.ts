import type { Club } from '@/lib/types/config';
import type { ForecastBundle } from '@/lib/types/forecast';
import type { WaterLevelStatus, SurgeAlert } from '@/lib/types/water';
import type { CrossingPlan } from '@/lib/types/crossing';
import { fetchForecast } from '@/lib/services/openMeteoForecast';
import { fetchMarine } from '@/lib/services/openMeteoMarine';
import { fetchWaterLevel } from '@/lib/services/inaHidrologico';
import { normalizeForecast } from '@/lib/transforms/normalizeForecast';
import { normalizeWaterLevel } from '@/lib/transforms/normalizeWaterLevel';
import { scoreDays } from '@/lib/domain/scoring';
import { detectSurge } from '@/lib/domain/surge';
import { planCrossing } from '@/lib/domain/routing';
import { getRoute } from '@/lib/config/routes';

/** Pronóstico normalizado + días puntuados + alertas de surge para un club. */
export async function getForecastBundle(club: Club): Promise<{
  bundle: ForecastBundle;
  surge: SurgeAlert[];
}> {
  const [forecast, marine] = await Promise.all([
    fetchForecast(club.lat, club.lon),
    fetchMarine(club.lat, club.lon),
  ]);
  const hourly = normalizeForecast(forecast, marine);
  const surge = detectSurge(hourly);
  const days = scoreDays(hourly, undefined, surge);
  const fetchedAt = new Date().toISOString();

  return {
    bundle: {
      club: {
        id: club.id,
        name: club.name,
        lat: club.lat,
        lon: club.lon,
        timezone: club.timezone,
      },
      fetchedAt,
      hourly,
      days,
    },
    surge,
  };
}

export async function getWaterStatus(stationId?: string): Promise<WaterLevelStatus> {
  const res = await fetchWaterLevel(stationId);
  return normalizeWaterLevel(res, new Date().toISOString());
}

/** Plan de cruce para una ruta, usando el viento muestreado en su punto medio. */
export async function getCrossingPlan(routeId: string): Promise<CrossingPlan> {
  const route = getRoute(routeId);
  const mid = route.waypoints[Math.floor(route.waypoints.length / 2)];
  const [forecast, marine] = await Promise.all([
    fetchForecast(mid.lat, mid.lon),
    fetchMarine(mid.lat, mid.lon),
  ]);
  const hourly = normalizeForecast(forecast, marine);
  return planCrossing(route, hourly);
}
