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
    // El INA publica una medición por hora: 30 min de staleTime (el default)
    // dejaba el nivel hasta una hora y media atrás. Y como con el pronóstico,
    // una PWA abierta en pantalla no pierde el foco: sin intervalo no se
    // renovaba nunca.
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
}
