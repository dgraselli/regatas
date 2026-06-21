'use client';

import { useQuery } from '@tanstack/react-query';
import { getWaterStatus } from '@/lib/services';
import { nearestStation } from '@/lib/config/inaStations';

/** Nivel de agua observado de la estación del INA más cercana al lugar activo. */
export function useWaterLevel(loc: { lat: number; lon: number } | null) {
  const station = loc ? nearestStation(loc.lat, loc.lon) : null;
  return useQuery({
    queryKey: ['water-level', station?.seriesId ?? 'none'],
    queryFn: () => getWaterStatus(loc!),
    enabled: !!loc,
  });
}
