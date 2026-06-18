'use client';

import type { DayScore } from '@/lib/types/forecast';
import { DayCard } from './DayCard';

export function ForecastStrip({
  days,
  selectedDate,
  onSelect,
}: {
  days: DayScore[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {days.map((d) => (
        <DayCard
          key={d.date}
          day={d}
          selected={d.date === selectedDate}
          onSelect={() => onSelect(d.date)}
        />
      ))}
    </div>
  );
}
