'use client';

import type { SurgeAlert } from '@/lib/types/water';
import type { FogAlert } from '@/lib/types/forecast';
import { formatDate, formatHour, formatVisibility } from '@/lib/format';

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

const FOG_STYLES: Record<number, string> = {
  1: 'bg-slate-50 border-slate-300 text-slate-700',
  2: 'bg-slate-200 border-slate-500 text-slate-900',
};

/**
 * Lista consolidada de alertas de niebla: una sola tarjeta con una fila por
 * ventana, en vez de un banner grande por día. Compacta y comparable de un
 * vistazo. El borde toma el color de la severidad más alta.
 */
export function FogAlertList({ alerts }: { alerts: FogAlert[] }) {
  if (alerts.length === 0) return null;

  const maxSeverity = Math.max(...alerts.map((a) => a.severity)) as 1 | 2;
  const hasNiebla = alerts.some((a) => a.severity === 2);
  const hasNeblina = alerts.some((a) => a.severity === 1);
  const title =
    hasNiebla && hasNeblina
      ? 'Niebla / visibilidad reducida'
      : hasNiebla
        ? 'Niebla'
        : 'Visibilidad reducida';

  return (
    <div className={`rounded-lg border ${FOG_STYLES[maxSeverity]}`}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <span className="font-semibold">
          🌫️ {title}
          {alerts.length > 1 && (
            <span className="ml-1 font-normal opacity-70">
              · {alerts.length} ventanas
            </span>
          )}
        </span>
      </div>
      <ul className="divide-y divide-current/10">
        {alerts.map((a, i) => {
          const sameDay = a.startsAt.slice(0, 10) === a.endsAt.slice(0, 10);
          return (
            <li
              key={i}
              className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="font-medium">{formatDate(a.startsAt)}</span>{' '}
                <span className="opacity-80">
                  {formatHour(a.startsAt)}–
                  {sameDay ? '' : `${formatDate(a.endsAt)} `}
                  {formatHour(a.endsAt)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <span className="rounded bg-current/10 px-1.5 py-0.5 font-medium">
                  {a.severity === 2 ? 'niebla' : 'neblina'}
                </span>
                <span className="opacity-80">vis. {formatVisibility(a.minVisibilityM)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function NoFogAlerts() {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm">
      ✓ Sin niebla marcada prevista en el horizonte del pronóstico.
    </div>
  );
}
