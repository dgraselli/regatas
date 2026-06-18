'use client';

import { useQuery } from '@tanstack/react-query';
import { getForecastBundle } from '@/lib/services';
import { getClub } from '@/lib/config/clubs';

export function useForecast(clubId: string) {
  return useQuery({
    queryKey: ['forecast', clubId],
    queryFn: () => getForecastBundle(getClub(clubId)),
  });
}
