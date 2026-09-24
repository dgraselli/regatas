'use client';

import Link from 'next/link';
import type { WaterLevelStatus, SurgeAlert } from '@/lib/types/water';
import { formatDate, formatHour } from '@/lib/format';
import { useObservationAge } from '@/lib/hooks/useFreshness';
import { useNowInTz } from '@/lib/hooks/useNow';
import { buildTideWindow, type TideWindow } from '@/lib/domain/tideWindow';
import type { HourlyPoint } from '@/lib/types/forecast';
import { TIMEZONE } from '@/lib/profile/defaults';

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

type LevelNote = { tone: 'red' | 'amber' | 'green'; text: string };

/**
 * Traduce la ventana de marea al veredicto de la amarra. La clave es la tercera
 * rama: cuando la banda de incertidumbre cruza el umbral, la app NO sabe de qué
 * lado está y lo dice. Se midió que en esa franja —el dato a menos de 30 cm del
 * umbral— la respuesta binaria se equivoca entre el 21 % y el 34 % de las veces;
 * decir "no puedo asegurarlo" es más útil que un verde o un rojo inventado.
 */
function assessLevel(
  win: TideWindow,
  safeMinM?: number,
  safeMaxM?: number,
): LevelNote | null {
  const now = win.now;
  if (!now || (safeMinM == null && safeMaxM == null)) return null;
  const lo = now.heightM - now.uncertaintyM;
  const hi = now.heightM + now.uncertaintyM;

  if (safeMinM != null && hi <= safeMinM) {
    return {
      tone: 'red',
      text: `Por debajo de tu mínimo seguro (${safeMinM.toFixed(2)} m): riesgo de varar al entrar/salir.`,
    };
  }
  if (safeMaxM != null && lo >= safeMaxM) {
    return {
      tone: 'red',
      text: `Por encima de tu máximo seguro (${safeMaxM.toFixed(2)} m): agua muy alta para la amarra.`,
    };
  }
  if (safeMinM != null && lo <= safeMinM) {
    return {
      tone: 'amber',
      text: `Rozando tu mínimo (${safeMinM.toFixed(2)} m). Con el margen de error no puedo asegurarte de qué lado está.`,
    };
  }
  if (safeMaxM != null && hi >= safeMaxM) {
    return {
      tone: 'amber',
      text: `Rozando tu máximo (${safeMaxM.toFixed(2)} m). Con el margen de error no puedo asegurarte de qué lado está.`,
    };
  }
  return { tone: 'green', text: 'Dentro de tu rango seguro.' };
}

/** "Podés salir hasta las HH:MM" / "vuelve a estar bien a partir de…". */
function windowNote(win: TideWindow): string | null {
  const first = win.unsafe[0];
  if (!first) return null;
  const que = first.kind === 'bajo' ? 'Poca agua' : 'Agua alta';
  // Ya estamos dentro del tramo malo: lo útil es cuándo se despeja.
  if (win.now && first.startsAt <= win.now.time) {
    return first.endsAt
      ? `${que} ahora; mejora a partir de las ${formatHour(first.endsAt)}.`
      : `${que} ahora y en todo el resto del día.`;
  }
  const hasta = `Podés salir hasta las ${formatHour(first.startsAt)}`;
  return first.endsAt
    ? `${hasta}; después ${que.toLowerCase()} hasta las ${formatHour(first.endsAt)}.`
    : `${hasta}; después ${que.toLowerCase()} el resto del día.`;
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
 * el nivel observado contra ellos. Es lo glanceable; el detalle vive en Mareas.
 */
export function TideSummary({
  status,
  hourly = [],
  surge,
  safeMinM,
  safeMaxM,
  timezone = TIMEZONE,
}: {
  status?: WaterLevelStatus;
  /** Pronóstico horario; aporta `seaLevelM` para estimar el nivel de ahora en adelante. */
  hourly?: HourlyPoint[];
  surge: SurgeAlert[];
  safeMinM?: number;
  safeMaxM?: number;
  timezone?: string;
}) {
  const obs = status?.observations ?? [];
  const last = obs[obs.length - 1];
  // Antigüedad del dato MEDIDO (no de la descarga): el SHN publica minutos
  // después de medir a los :45 (el INA, de respaldo, con 1–2 h), así que el
  // nivel que mostramos nunca es exactamente el de ahora.
  const age = useObservationAge(last?.time);
  const now = useNowInTz(timezone);
  // Evento más severo primero.
  const events = [...surge].sort((a, b) => b.severity - a.severity);
  const win = buildTideWindow(obs, hourly, now, { safeMinM, safeMaxM });
  const levelNote = assessLevel(win, safeMinM, safeMaxM);
  const salida = windowNote(win);

  if (!last && events.length === 0) return null;

  return (
    <Link
      href="/mareas"
      aria-label="Ver detalle en Mareas"
      className="block rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-mar-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-mar-400"
    >
      {last && (
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="text-slate-700">🌊 Marea</span>
            <span className="text-xl font-semibold text-slate-800">
              {(win.now ?? last).heightM.toFixed(2)} m
            </span>
            {/* La banda solo aparece si el número es una estimación: una
                medición de la hora en curso no lleva margen. */}
            {win.now && win.now.uncertaintyM > 0 && (
              <span className="text-sm text-slate-500">± {win.now.uncertaintyM.toFixed(2)}</span>
            )}
            <span className={`text-sm font-medium ${TREND[status!.trend].color}`}>
              {TREND[status!.trend].arrow} {TREND[status!.trend].label}
            </span>
          </div>
          <div className="flex flex-col items-end text-xs">
            <span className="text-slate-400">{status!.stationName}</span>
            <span className={age?.stale ? 'font-medium text-amber-700' : 'text-slate-400'}>
              {age?.stale && '⚠️ '}
              {win.now?.source === 'medido' ? 'medido' : 'estimado'} · observado{' '}
              {age?.agoLabel ?? ''}
            </span>
          </div>
        </div>
      )}

      {age?.severe && (
        <p className="text-sm mt-2 text-amber-700">
          ⚠️ Último dato {age.agoLabel}: la estación puede estar caída.
        </p>
      )}

      {salida && <p className="text-sm mt-2 font-medium text-slate-700">🕒 {salida}</p>}

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

      <p className="text-xs text-mar-600 mt-2">Ver detalle en Mareas →</p>
    </Link>
  );
}
