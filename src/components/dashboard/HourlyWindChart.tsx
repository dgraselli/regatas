'use client';

import type { HourlyPoint } from '@/lib/types/forecast';
import { formatHour, compass } from '@/lib/format';

/** Gráfico simple de barras de viento/ráfagas por hora (solo SVG, sin librerías). */
export function HourlyWindChart({ points }: { points: HourlyPoint[] }) {
  if (points.length === 0) return null;
  const maxKt = Math.max(20, ...points.map((p) => p.gustKt));
  const barW = 14;
  const gap = 4;
  const height = 120;
  const width = points.length * (barW + gap);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height + 28} className="text-mar-500">
        {points.map((p, i) => {
          const x = i * (barW + gap);
          const wh = (p.windKt / maxKt) * height;
          const gh = (p.gustKt / maxKt) * height;
          return (
            <g key={p.time}>
              {/* ráfaga (claro) */}
              <rect x={x} y={height - gh} width={barW} height={gh} className="fill-mar-200" rx={2} />
              {/* viento (oscuro) */}
              <rect x={x} y={height - wh} width={barW} height={wh} className="fill-mar-500" rx={2} />
              {i % 3 === 0 && (
                <text x={x + barW / 2} y={height + 12} textAnchor="middle" className="fill-slate-400 text-[9px]">
                  {formatHour(p.time)}
                </text>
              )}
              {i % 3 === 0 && (
                <text x={x + barW / 2} y={height + 24} textAnchor="middle" className="fill-slate-300 text-[8px]">
                  {compass(p.windDir)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 text-xs text-slate-500 mt-1">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-mar-500" /> Viento (kt)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-mar-200" /> Ráfagas (kt)
        </span>
      </div>
    </div>
  );
}
