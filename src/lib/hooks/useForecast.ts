'use client';

import { useQuery } from '@tanstack/react-query';
import { getForecastBundle, type ForecastPoint } from '@/lib/services';
import { scoringFor } from '@/lib/config/boat';
import type { Caution, Propulsion } from '@/lib/profile/types';

export function useForecast(
  loc: ForecastPoint | null,
  caution: Caution = 'normal',
  lowWindKt?: number,
  propulsion: Propulsion = 'vela',
) {
  return useQuery({
    queryKey: ['forecast', loc?.id ?? 'none', caution, lowWindKt ?? 'def', propulsion],
    queryFn: () => {
      const t = scoringFor(caution);
      // El umbral de "poco viento" lo configura el usuario (default: el del perfil normal).
      return getForecastBundle(
        loc!,
        { ...t, idealWindMin: lowWindKt ?? t.idealWindMin },
        propulsion,
      );
    },
    enabled: !!loc,
  });
}
