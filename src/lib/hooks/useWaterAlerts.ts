'use client';

import { useMemo } from 'react';
import type { ForecastBundle } from '@/lib/types/forecast';
import type { SurgeAlert, WaterLevelStatus } from '@/lib/types/water';
import type { Caution, Propulsion } from '@/lib/profile/types';
import { combineWaterAlerts, mooringAlerts, projectMooringLevel } from '@/lib/domain/mooringLevel';
import { scoreDays } from '@/lib/domain/scoring';
import { forecastThresholds } from '@/lib/hooks/useForecast';

/**
 * Alertas de agua del lugar activo y días puntuados con ellas.
 *
 * Si el lugar tiene rango seguro y hay mediciones del mareógrafo para anclar el
 * modelo, los avisos salen del nivel estimado EN LA AMARRA (`mooringLevel.ts`) y
 * reemplazan a las sudestadas/bajantes regionales (salvo las severas). Si no, se
 * usan las regionales tal como vienen del pronóstico.
 */
export function useWaterAlerts(args: {
  location: { lat: number; lon: number; safeLevelMinM?: number; safeLevelMaxM?: number } | null;
  forecast?: { bundle: ForecastBundle; surge: SurgeAlert[] };
  water?: WaterLevelStatus;
  now: string;
  caution?: Caution;
  lowWindKt?: number;
  propulsion?: Propulsion;
}) {
  const { location, forecast, water, now, caution, lowWindKt, propulsion = 'vela' } = args;
  const safeMinM = location?.safeLevelMinM;
  const safeMaxM = location?.safeLevelMaxM;
  // Sólo importa la hora: recalcular cada minuto no cambia nada.
  const nowHour = now.slice(0, 13);

  return useMemo(() => {
    const regional = forecast?.surge ?? [];
    const days = forecast?.bundle.days ?? [];
    const hasRange = safeMinM != null || safeMaxM != null;
    const projection =
      hasRange && forecast?.bundle.seaLevel?.length && water?.observations.length
        ? projectMooringLevel(forecast.bundle.seaLevel, water.observations)
        : null;
    if (!forecast || !projection) {
      return { surge: regional, days, projection: null, fromMooring: false };
    }
    const surge = combineWaterAlerts(
      regional,
      mooringAlerts(projection, { safeMinM, safeMaxM }, `${nowHour}:00`),
    );
    const { club, hourly } = forecast.bundle;
    return {
      surge,
      days: scoreDays(hourly, forecastThresholds(caution, lowWindKt), surge, propulsion, {
        lat: club.lat,
        lon: club.lon,
      }),
      projection,
      fromMooring: true,
    };
  }, [forecast, water, safeMinM, safeMaxM, nowHour, caution, lowWindKt, propulsion]);
}
