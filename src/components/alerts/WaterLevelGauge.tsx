'use client';

import type { WaterLevelStatus } from '@/lib/types/water';
import { formatHour } from '@/lib/format';

const TREND: Record<WaterLevelStatus['trend'], { label: string; arrow: string; color: string }> = {
  subiendo: { label: 'Subiendo', arrow: '↑', color: 'text-orange-600' },
  bajando: { label: 'Bajando', arrow: '↓', color: 'text-mar-600' },
  estable: { label: 'Estable', arrow: '→', color: 'text-slate-500' },
};

export function WaterLevelGauge({ status }: { status: WaterLevelStatus }) {
  const obs = status.observations;
  if (obs.length === 0) return null;
  const last = obs[obs.length - 1];
  const t = TREND[status.trend];

  const heights = obs.map((o) => o.heightM);
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  const span = max - min || 1;
  const w = 240;
  const h = 60;
  const padLeft = 34; // espacio para los rótulos de nivel (m) del eje Y
  const plotW = w - padLeft;

  const yFor = (m: number) => h - ((m - min) / span) * h;
  const xFor = (i: number) => padLeft + (obs.length === 1 ? 0 : (i / (obs.length - 1)) * plotW);

  const path = obs
    .map((o, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(o.heightM).toFixed(1)}`)
    .join(' ');

  // Referencias del eje Y: nivel máximo, medio y mínimo observados (en metros).
  const yTicks = [max, (max + min) / 2, min];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-3xl font-semibold text-slate-800">{last.heightM.toFixed(2)} m</span>
          <span className={`ml-2 font-medium ${t.color}`}>
            {t.arrow} {t.label}
          </span>
        </div>
        <span className="text-xs text-slate-400">{status.stationName}</span>
      </div>
      <svg width={w} height={h + 6} className="mt-3 max-w-full">
        {/* Eje Y: líneas guía y rótulo de nivel (m) para máx / medio / mín */}
        {yTicks.map((m, i) => {
          const y = yFor(m);
          return (
            <g key={i}>
              <line x1={padLeft} y1={y} x2={w} y2={y} className="stroke-slate-100" strokeWidth={1} />
              <text x={padLeft - 4} y={y + 3} textAnchor="end" className="fill-slate-400 text-[9px]">
                {m.toFixed(2)}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" className="stroke-mar-500" strokeWidth={2} />
      </svg>
      <div className="flex justify-between text-xs text-slate-400" style={{ paddingLeft: padLeft }}>
        <span>{formatHour(obs[0].time)}</span>
        <span>últimas {obs.length} h · {formatHour(last.time)}</span>
      </div>
    </div>
  );
}
