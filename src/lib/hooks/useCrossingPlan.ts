'use client';

import { useQuery } from '@tanstack/react-query';
import { getCrossingPlan } from '@/lib/services';

export function useCrossingPlan(routeId: string) {
  return useQuery({
    queryKey: ['crossing', routeId],
    queryFn: () => getCrossingPlan(routeId),
  });
}
