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

/** Margen (m) para avisar que el nivel se está "acercando" a un umbral. */
const NEAR_M = 0.2;

type LevelNote = { tone: 'red' | 'amber' | 'green'; text: string };

/**
 * Evalúa el nivel observado contra los niveles seguros que el usuario definió
 * para su amarra (si los definió). Devuelve null si no hay umbrales o no hay dato.
 */
function assessLevel(
  status: WaterLevelStatus | undefined,
  heightM: number | undefined,
  safeMinM?: number,
  safeMaxM?: number,
): LevelNote | null {
  if (heightM == null || (safeMinM == null && safeMaxM == null)) return null;
  if (safeMinM != null && heightM <= safeMinM) {
    return {
      tone: 'red',
      text: `Por debajo de tu mínimo seguro (${safeMinM.toFixed(2)} m): riesgo de varar al entrar/salir.`,
    };
  }
  if (safeMaxM != null && heightM >= safeMaxM) {
    return {
      tone: 'red',
      text: `Por encima de tu máximo seguro (${safeMaxM.toFixed(2)} m): agua muy alta para la amarra.`,
    };
  }
  if (safeMinM != null && heightM - safeMinM < NEAR_M && status?.trend === 'bajando') {
    return { tone: 'amber', text: `Acercándose a tu mínimo (${safeMinM.toFixed(2)} m) y bajando.` };
  }
  if (safeMaxM != null && safeMaxM - heightM < NEAR_M && status?.trend === 'subiendo') {
    return { tone: 'amber', text: `Acercándose a tu máximo (${safeMaxM.toFixed(2)} m) y subiendo.` };
  }
  return { tone: 'green', text: 'Dentro de tu rango seguro.' };
}

const NOTE_COLOR: Record<LevelNote['tone'], string> = {
  red: 'text-red-700',
  amber: 'text-amber-700',
  green: 'text-emerald-700',
};

/**
 * Resumen de marea para el panel: nivel observado actual + tendencia, y —si se
 * prevé sudestada/bajante— un aviso de agua alta/baja en clave de entrada/salida
 * de amarra. Si la amarra activa tiene niveles seguros definidos, además evalúa
 * el nivel observado contra ellos. Es lo glanceable; el detalle vive en Alertas.
 */
export function TideSummary({
  status,
  surge,
  safeMinM,
  safeMaxM,
}: {
  status?: WaterLevelStatus;
  surge: SurgeAlert[];
  safeMinM?: number;
  safeMaxM?: number;
}) {
  const obs = status?.observations ?? [];
  const last = obs[obs.length - 1];
  // Evento más severo primero.
  const events = [...surge].sort((a, b) => b.severity - a.severity);
  const levelNote = assessLevel(status, last?.heightM, safeMinM, safeMaxM);

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

      {levelNote && (
        <p className={`text-sm mt-2 font-medium ${NOTE_COLOR[levelNote.tone]}`}>
          {levelNote.tone === 'green' ? '✓' : '⚠️'} {levelNote.text}
        </p>
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
