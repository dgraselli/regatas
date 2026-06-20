'use client';

import type { SurgeAlert } from '@/lib/types/water';
import { formatDate, formatHour } from '@/lib/format';

const STYLES: Record<number, string> = {
  1: 'bg-amber-50 border-amber-200 text-amber-800',
  2: 'bg-orange-50 border-orange-300 text-orange-900',
  3: 'bg-red-50 border-red-300 text-red-900',
};

function icon(type: SurgeAlert['type']) {
  return type === 'sudestada' ? '🌊⬆️' : '🏜️⬇️';
}

export function AlertBanner({ alert }: { alert: SurgeAlert }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${STYLES[alert.severity]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold capitalize">
          {icon(alert.type)} {alert.type}
        </span>
        <span className="text-xs opacity-80">
          confianza {Math.round(alert.confidence * 100)}%
        </span>
      </div>
      <p className="text-sm mt-1">{alert.message}</p>
      <p className="text-xs mt-2 opacity-80">
        {formatDate(alert.startsAt)} {formatHour(alert.startsAt)} →{' '}
        {formatDate(alert.endsAt)} {formatHour(alert.endsAt)} · viento medio {alert.avgWindKt} kt
      </p>
    </div>
  );
}

export function NoAlerts() {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm">
      ✓ Sin sudestadas ni bajantes pronunciadas previstas en el horizonte del pronóstico.
    </div>
  );
}
