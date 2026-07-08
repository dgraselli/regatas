'use client';

import type { DayScore } from '@/lib/types/forecast';
import { DayCard } from './DayCard';

export function ForecastStrip({
  days,
  selectedDate,
  onSelect,
  fogYellowM,
  fogRedM,
}: {
  days: DayScore[];
  selectedDate: string;
  onSelect: (date: string) => void;
  /** Umbral (m) de visibilidad para marcar neblina en la tarjeta. */
  fogYellowM: number;
  /** Umbral (m) de visibilidad para marcar niebla (más cerrada) en la tarjeta. */
  fogRedM: number;
}) {
  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2">
      {days.map((d) => (
        <DayCard
          key={d.date}
          day={d}
          selected={d.date === selectedDate}
          onSelect={() => onSelect(d.date)}
          fogYellowM={fogYellowM}
          fogRedM={fogRedM}
        />
      ))}
    </div>
  );
}
