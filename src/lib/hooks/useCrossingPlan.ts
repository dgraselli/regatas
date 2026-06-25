'use client';

import { useQuery } from '@tanstack/react-query';
import { getCrossingPlan } from '@/lib/services';
import { generatePolar, deriveRouting } from '@/lib/domain/polarModel';
import { scoringFor } from '@/lib/config/boat';
import type { RoutePoint } from '@/lib/types/config';
import type { Boat, Caution } from '@/lib/profile/types';

export function useCrossingPlan(
  from: RoutePoint | null,
  to: RoutePoint | null,
  boat: Boat | null,
  caution: Caution = 'normal',
) {
  const lengthFt = boat?.lengthFt ?? 23;
  return useQuery({
    queryKey: ['crossing', from?.name ?? 'none', to?.name ?? 'none', lengthFt, caution],
    queryFn: () =>
      getCrossingPlan(
        from!,
        to!,
        generatePolar(lengthFt),
        deriveRouting(lengthFt),
        scoringFor(caution),
      ),
    enabled: !!from && !!to,
  });
}
