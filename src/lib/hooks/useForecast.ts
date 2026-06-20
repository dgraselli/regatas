'use client';

import { useQuery } from '@tanstack/react-query';
import { getForecastBundle, type ForecastPoint } from '@/lib/services';
import { scoringFor } from '@/lib/config/boat';
import type { Caution } from '@/lib/profile/types';

export function useForecast(loc: ForecastPoint | null, caution: Caution = 'normal') {
  return useQuery({
    queryKey: ['forecast', loc?.id ?? 'none', caution],
    queryFn: () => getForecastBundle(loc!, scoringFor(caution)),
    enabled: !!loc,
  });
}
