'use client';

import type { DepartureCandidate } from '@/lib/types/crossing';
import { formatDate, formatHour, formatDuration } from '@/lib/format';

export function DepartureRanker({
  candidates,
  selectedIndex,
  onSelect,
}: {
  candidates: DepartureCandidate[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {candidates.slice(0, 8).map((c, i) => {
        const selected = i === selectedIndex;
        const best = i === 0;
        return (
          <button
            key={c.departAt}
            onClick={() => onSelect(i)}
            className={`min-w-[160px] text-left rounded-xl border p-3 transition-all ${
              selected ? 'border-mar-500 ring-2 ring-mar-200' : 'border-slate-200 hover:border-mar-300'
            } bg-white`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{formatDate(c.departAt)}</span>
              {best && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                  mejor
                </span>
              )}
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-800">
              Salir {formatHour(c.departAt)}
            </div>
            <div className="text-sm text-slate-600">
              llega {formatHour(c.arriveAt)} · {formatDuration(c.totalHours)}
            </div>
            <div className="mt-2 text-xs">
              {c.warnings.length === 0 ? (
                <span className="text-emerald-600">sin advertencias</span>
              ) : (
                <span className="text-amber-600">{c.warnings.length} advertencia(s)</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
