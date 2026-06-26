'use client';

import type { DayScore, SkyCondition } from '@/lib/types/forecast';
import { TrafficLight } from './TrafficLight';
import { WindArrow } from '@/components/common/WindArrow';
import { formatDate } from '@/lib/format';

/** Texto de niebla temporal: "niebla" si es cerrada, "neblina" si es liviana. */
function partialFogLabel(pf: NonNullable<DayScore['partialFog']>): string {
  const noun = pf.dense ? 'Niebla' : 'Neblina';
  const when = pf.when === 'manana' ? 'a primera hora' : 'por la tarde';
  return `${noun} temporal ${when}`;
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
}: {
  day: DayScore;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`min-w-[150px] text-left rounded-xl border p-3 transition-all ${
        selected ? 'border-mar-500 ring-2 ring-mar-200 bg-white' : 'border-slate-200 bg-white hover:border-mar-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-slate-700">{formatDate(day.date)}</span>
        {day.condition && (
          <span
            className="text-2xl leading-none"
            title={CONDITION[day.condition].label}
            aria-label={CONDITION[day.condition].label}
          >
            {CONDITION[day.condition].emoji}
          </span>
        )}
      </div>
      <div className="mt-2">
        <TrafficLight level={day.level} size="sm" />
      </div>
      {day.partialFog && (
        <p
          className="mt-1.5 text-xs font-medium text-slate-500"
          title="Niebla solo en parte del día: queda una ventana navegable"
        >
          {partialFogLabel(day.partialFog)}
        </p>
      )}
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
      </div>
    </button>
  );
}
