'use client';

import type { DayScore } from '@/lib/types/forecast';
import { TrafficLight, levelDot } from './TrafficLight';
import { WindArrow } from '@/components/common/WindArrow';
import { formatDate } from '@/lib/format';

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
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-700">{formatDate(day.date)}</span>
        <span aria-hidden>{levelDot(day.level)}</span>
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
      <div className="mt-1 text-xs text-slate-400">
        {day.metrics.tempMinC}–{day.metrics.tempMaxC}°C
        {day.metrics.precipTotalMm > 0 && ` · ${day.metrics.precipTotalMm} mm`}
      </div>
    </button>
  );
}
