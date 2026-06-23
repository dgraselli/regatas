'use client';

import { useFreshness } from '@/lib/hooks/useFreshness';

export function OfflineBadge({ fetchedAt }: { fetchedAt?: string }) {
  const f = useFreshness(fetchedAt);
  if (!f) return null;
  return (
    <span className={`text-xs ${f.stale ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
      Datos del {f.absLabel}
    </span>
  );
}
