'use client';

import { useQuery } from '@tanstack/react-query';
import { getForecastBundle, type ForecastPoint } from '@/lib/services';
import { scoringFor } from '@/lib/config/boat';
import type { Caution, Propulsion } from '@/lib/profile/types';

/** Umbrales del semáforo según la tolerancia y el umbral de poco viento del usuario. */
export function forecastThresholds(caution: Caution = 'normal', lowWindKt?: number) {
  const t = scoringFor(caution);
  return { ...t, idealWindMin: lowWindKt ?? t.idealWindMin };
}

export function useForecast(
  loc: ForecastPoint | null,
  caution: Caution = 'normal',
  lowWindKt?: number,
  propulsion: Propulsion = 'vela',
) {
  return useQuery({
    queryKey: ['forecast', loc?.id ?? 'none', caution, lowWindKt ?? 'def', propulsion],
    // El umbral de "poco viento" lo configura el usuario (default: el del perfil normal).
    queryFn: () => getForecastBundle(loc!, forecastThresholds(caution, lowWindKt), propulsion),
    enabled: !!loc,
    // Una pestaña/PWA que queda abierta en pantalla nunca pierde el foco:
    // sin intervalo, el pronóstico no se renovaría jamás.
    refetchInterval: 30 * 60 * 1000,
  });
}
