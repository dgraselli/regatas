'use client';

import { useQuery } from '@tanstack/react-query';
import { getMetarObservation } from '@/lib/services/metar';
import { nearestMetarStation } from '@/lib/config/metarStations';

/**
 * Visibilidad observada (METAR) del aeropuerto más cercano al lugar activo. Es un
 * dato complementario "de ahora": si el proxy no responde, la query da null y no se
 * muestra nada. METAR es ~horario; el intervalo mantiene fresca una pestaña que
 * queda abierta (el refetch on focus no alcanza si nunca pierde el foco).
 */
export function useMetarObservation(loc: { lat: number; lon: number } | null) {
  const station = loc ? nearestMetarStation(loc.lat, loc.lon) : null;
  return useQuery({
    queryKey: ['metar', station?.icao ?? 'none'],
    queryFn: () => getMetarObservation(loc!),
    enabled: !!loc,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
}
