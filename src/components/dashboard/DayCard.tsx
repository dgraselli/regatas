'use client';

import type { DayScore, SkyCondition } from '@/lib/types/forecast';
import { TrafficLight } from './TrafficLight';
import { WindArrow } from '@/components/common/WindArrow';
import { formatDateShort, formatVisibility } from '@/lib/format';
import { FogIcon } from '@/components/common/FogIcon';

/**
 * Estado de niebla del día a partir de la visibilidad mínima: `null` si no hay
 * niebla/neblina; `dense` = niebla cerrada (visibilidad ≤ umbral rojo) vs neblina.
 * Si el día ya marca `partialFog` (niebla que despeja) se respeta esa densidad.
 */
function fogState(
  day: DayScore,
  fogYellowM: number,
  fogRedM: number,
): { dense: boolean; visM: number } | null {
  if (day.partialFog) {
    const visM = day.metrics.visibilityMinM ?? fogYellowM;
    return { dense: day.partialFog.dense, visM };
  }
  const visM = day.metrics.visibilityMinM;
  if (visM == null || visM > fogYellowM) return null;
  return { dense: visM <= fogRedM, visM };
}

/** Ícono representativo del cielo del día (arriba a la derecha de la tarjeta). */
const CONDITION: Record<SkyCondition, { emoji: string; label: string }> = {
  soleado: { emoji: '☀️', label: 'Soleado' },
  parcial: { emoji: '⛅', label: 'Parcialmente nublado' },
  nublado: { emoji: '☁️', label: 'Nublado' },
  'lluvia-parcial': { emoji: '🌦️', label: 'Precipitación parcial' },
  lluvia: { emoji: '🌧️', label: 'Precipitación' },
};

export function DayCard({
  day,
  selected,
  onSelect,
  fogYellowM,
  fogRedM,
}: {
  day: DayScore;
  selected: boolean;
  onSelect: () => void;
  fogYellowM: number;
  fogRedM: number;
}) {
  const fog = fogState(day, fogYellowM, fogRedM);
  const fogLabel = fog ? (fog.dense ? 'Niebla' : 'Neblina') : '';
  return (
    <button
      onClick={onSelect}
      className={`min-w-[150px] text-left rounded-xl border p-3 transition-all ${
        selected ? 'border-mar-500 ring-2 ring-mar-200 bg-white' : 'border-slate-200 bg-white hover:border-mar-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-slate-700 whitespace-nowrap">{formatDateShort(day.date)}</span>
        {/* Niebla/neblina (si hay) a la izquierda del ícono de cielo, en gris. Al ser
            más baja que el emoji, no cambia la altura de la fila: el semáforo queda a
            la misma altura en todas las tarjetas, con o sin niebla. */}
        <span className="flex items-center gap-1 leading-none">
          {fog && (
            <span title={`${fogLabel}: visibilidad mínima ~${formatVisibility(fog.visM)}`}>
              <FogIcon dense={fog.dense} label={fogLabel} className="h-3 w-5" />
            </span>
          )}
          {day.condition && (
            <span
              className="text-2xl"
              title={CONDITION[day.condition].label}
              aria-label={CONDITION[day.condition].label}
            >
              {CONDITION[day.condition].emoji}
            </span>
          )}
        </span>
      </div>
      <div className="mt-2">
        <TrafficLight level={day.level} size="sm" />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>
          {day.metrics.windMedianKt} kt
          <span className="text-slate-400"> · ráf {day.metrics.gustPeakKt}</span>
        </span>
        <WindArrow deg={day.metrics.windDirDominant} />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
          <span aria-hidden className="text-[10px]">🌡️</span>
          {day.metrics.tempMinC}–{day.metrics.tempMaxC}°C
        </span>
        {day.metrics.precipTotalMm > 0 && (
          <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
            <span aria-hidden className="text-[10px]">🌧️</span>
            {day.metrics.precipTotalMm} mm
          </span>
        )}
        {day.metrics.waveMaxM != null && day.metrics.waveMaxM >= 0.5 && (
          <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
            <span aria-hidden className="text-[10px]">🌊</span>
            {day.metrics.waveMaxM.toFixed(1)} m
          </span>
        )}
        {fog && (
          <span
            className="inline-flex items-center gap-0.5 whitespace-nowrap"
            title={`${fogLabel}: visibilidad mínima`}
          >
            <FogIcon dense={fog.dense} />
            {formatVisibility(fog.visM)}
          </span>
        )}
      </div>
    </button>
  );
}
