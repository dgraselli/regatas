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

  const path = obs
    .map((o, i) => {
      const x = (i / (obs.length - 1)) * w;
      const y = h - ((o.heightM - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

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
      <svg width={w} height={h} className="mt-3 max-w-full">
        <path d={path} fill="none" className="stroke-mar-500" strokeWidth={2} />
      </svg>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{formatHour(obs[0].time)}</span>
        <span>últimas {obs.length} h · {formatHour(last.time)}</span>
      </div>
    </div>
  );
}
