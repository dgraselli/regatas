'use client';

import type { WaterLevelStatus, SurgeAlert } from '@/lib/types/water';
import { formatDate, formatHour } from '@/lib/format';

const TREND: Record<WaterLevelStatus['trend'], { label: string; arrow: string; color: string }> = {
  subiendo: { label: 'subiendo', arrow: '↑', color: 'text-orange-600' },
  bajando: { label: 'bajando', arrow: '↓', color: 'text-mar-600' },
  estable: { label: 'estable', arrow: '→', color: 'text-slate-500' },
};

function windowLabel(a: SurgeAlert): string {
  const sameDay = a.startsAt.slice(0, 10) === a.endsAt.slice(0, 10);
  return sameDay
    ? `${formatDate(a.startsAt)} ${formatHour(a.startsAt)}–${formatHour(a.endsAt)}`
    : `${formatDate(a.startsAt)} ${formatHour(a.startsAt)} → ${formatDate(a.endsAt)} ${formatHour(
        a.endsAt,
      )}`;
}

/**
 * Resumen de marea para el panel: nivel observado actual + tendencia, y —si se
 * prevé sudestada/bajante— un aviso de agua alta/baja en clave de entrada/salida
 * de amarra. Es lo glanceable; el detalle completo vive en la página de Alertas.
 */
export function TideSummary({
  status,
  surge,
}: {
  status?: WaterLevelStatus;
  surge: SurgeAlert[];
}) {
  const obs = status?.observations ?? [];
  const last = obs[obs.length - 1];
  // Evento más severo primero.
  const events = [...surge].sort((a, b) => b.severity - a.severity);

  if (!last && events.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      {last && (
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="text-slate-700">🌊 Marea</span>
            <span className="text-xl font-semibold text-slate-800">
              {last.heightM.toFixed(2)} m
            </span>
            <span className={`text-sm font-medium ${TREND[status!.trend].color}`}>
              {TREND[status!.trend].arrow} {TREND[status!.trend].label}
            </span>
          </div>
          <span className="text-xs text-slate-400">{status!.stationName} · observado</span>
        </div>
      )}

      {events.map((a, i) => {
        const alta = a.type === 'sudestada';
        return (
          <p key={i} className={`text-sm mt-2 ${alta ? 'text-orange-800' : 'text-mar-700'}`}>
            ⚠️ <strong>{alta ? 'Agua alta' : 'Agua baja'} prevista</strong> ({windowLabel(a)}) —{' '}
            {alta
              ? 'puede dificultar la entrada/salida de la amarra.'
              : 'riesgo de varadura al entrar/salir de la amarra.'}
          </p>
        );
      })}
    </div>
  );
}
