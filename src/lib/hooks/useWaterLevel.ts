'use client';

import { useQuery } from '@tanstack/react-query';
import { getWaterStatus } from '@/lib/services';

export function useWaterLevel(stationId?: string) {
  return useQuery({
    queryKey: ['water-level', stationId ?? 'default'],
    queryFn: () => getWaterStatus(stationId),
  });
}
