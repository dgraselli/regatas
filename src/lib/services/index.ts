import type { BoatPolar, RoutingConfig, ScoringThresholds, RoutePoint } from '@/lib/types/config';
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
import { buildRoute } from '@/lib/config/routes';
import { nearestStation } from '@/lib/config/inaStations';
import { TIMEZONE } from '@/lib/profile/defaults';

export interface ForecastPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  timezone?: string;
}

/** Pronóstico normalizado + días puntuados + alertas de surge para un lugar. */
export async function getForecastBundle(
  loc: ForecastPoint,
  thresholds?: ScoringThresholds,
): Promise<{ bundle: ForecastBundle; surge: SurgeAlert[] }> {
  const [forecast, marine] = await Promise.all([
    fetchForecast(loc.lat, loc.lon),
    fetchMarine(loc.lat, loc.lon),
  ]);
  const hourly = normalizeForecast(forecast, marine);
  const surge = detectSurge(hourly);
  const days = scoreDays(hourly, thresholds, surge);
  const fetchedAt = new Date().toISOString();

  return {
    bundle: {
      club: {
        id: loc.id,
        name: loc.name,
        lat: loc.lat,
        lon: loc.lon,
        timezone: loc.timezone ?? TIMEZONE,
      },
      fetchedAt,
      hourly,
      days,
    },
    surge,
  };
}

/** Nivel de agua observado de la estación del INA más cercana al lugar dado. */
export async function getWaterStatus(loc?: {
  lat: number;
  lon: number;
}): Promise<WaterLevelStatus> {
  const station = loc ? nearestStation(loc.lat, loc.lon) : undefined;
  const res = await fetchWaterLevel(station?.seriesId, station?.name);
  return normalizeWaterLevel(res, new Date().toISOString());
}

/**
 * Plan de cruce entre dos puntos, con la polar del barco del usuario.
 * El viento se muestrea en el punto medio de la derrota.
 */
export async function getCrossingPlan(
  from: RoutePoint,
  to: RoutePoint,
  polar: BoatPolar,
  routingCfg: RoutingConfig,
): Promise<CrossingPlan> {
  const route = buildRoute(from, to);
  const mid = route.waypoints[Math.floor(route.waypoints.length / 2)];
  const [forecast, marine] = await Promise.all([
    fetchForecast(mid.lat, mid.lon),
    fetchMarine(mid.lat, mid.lon),
  ]);
  const hourly = normalizeForecast(forecast, marine);
  return planCrossing(route, hourly, polar, routingCfg);
}
