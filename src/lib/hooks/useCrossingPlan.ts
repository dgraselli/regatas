'use client';

import { useQuery } from '@tanstack/react-query';
import { getCrossingPlan } from '@/lib/services';
import { generatePolar, deriveRouting } from '@/lib/domain/polarModel';
import type { RoutePoint } from '@/lib/types/config';
import type { Boat } from '@/lib/profile/types';

export function useCrossingPlan(
  from: RoutePoint | null,
  to: RoutePoint | null,
  boat: Boat | null,
) {
  const lengthFt = boat?.lengthFt ?? 23;
  return useQuery({
    queryKey: ['crossing', from?.name ?? 'none', to?.name ?? 'none', lengthFt],
    queryFn: () =>
      getCrossingPlan(from!, to!, generatePolar(lengthFt), deriveRouting(lengthFt)),
    enabled: !!from && !!to,
  });
}
