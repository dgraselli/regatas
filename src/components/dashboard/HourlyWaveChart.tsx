'use client';

import { useEffect, useRef, useState } from 'react';
import type { HourlyPoint } from '@/lib/types/forecast';
import { type Caution } from '@/lib/profile/types';
import { scoringFor } from '@/lib/config/boat';
import { formatHour, compass } from '@/lib/format';

/**
 * Escala vertical fija (m) del oleaje, para que días distintos sean comparables a
 * simple vista (igual criterio que el gráfico de viento).
 */
const MAX_M = 3;
const TICKS = [0, 1, 2, 3];

/**
 * Gráfico chico de altura de ola por hora (barras) con la dirección de la ola y
 * las líneas de umbral (precaución/peligro según tolerancia). Va debajo del de
 * viento y comparte el mismo layout horizontal para que las horas queden
 * alineadas. Se autooculta si no hay dato marino de olas.
 */
export function HourlyWaveChart({
  points,
  caution = 'normal',
}: {
  points: HourlyPoint[];
  caution?: Caution;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setContainerW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) return null;
  // Sin dato marino de olas no se dibuja nada.
  if (!points.some((p) => p.waveHeightM != null)) return null;

  const t = scoringFor(caution);
  const yellow = t.waveYellowM;
  const red = t.waveRedM;

  // Mismo layout que el gráfico de viento para alinear las horas.
  const padLeft = 22;
  const gap = 4;
  const minSlot = 12;
  const n = points.length;
  const avail = Math.max(0, containerW - padLeft);
  const slot = Math.max(minSlot, avail / n);
  const barW = Math.max(6, slot - gap);
  const height = 64;
  const width = padLeft + n * slot;
  const labelEvery = slot >= 26 ? 1 : 3;
  const hasDir = points.some((p) => p.waveDir != null);

  // m → coordenada vertical (escala fija, recortando lo que supere MAX_M).
  const y = (m: number) => height - (Math.min(m, MAX_M) / MAX_M) * height;

  return (
    <div ref={wrapRef} className="w-full overflow-x-auto">
      <svg width={width} height={height + (hasDir ? 30 : 18)} className="max-w-none">
        {/* Eje Y: grilla y escala fija */}
        {TICKS.map((m) => (
          <g key={m}>
            <line x1={padLeft} y1={y(m)} x2={width} y2={y(m)} className="stroke-slate-100" strokeWidth={1} />
            <text x={padLeft - 4} y={y(m) + 3} textAnchor="end" className="fill-slate-300 text-[8px]">
              {m}
            </text>
          </g>
        ))}

        {/* Barras de altura de ola + hora + flecha de dirección (hacia dónde va la ola) */}
        {points.map((p, i) => {
          if (p.waveHeightM == null) return null;
          const x = padLeft + i * slot + (slot - gap - barW) / 2;
          const cx = x + barW / 2;
          const hy = y(p.waveHeightM);
          const title =
            `Ola ${p.waveHeightM.toFixed(1)} m` +
            (p.waveDir != null ? ` del ${compass(p.waveDir)}` : '') +
            (p.wavePeriodS != null ? ` · período ${Math.round(p.wavePeriodS)} s` : '');
          return (
            <g key={p.time}>
              <rect x={x} y={hy} width={barW} height={height - hy} className="fill-cyan-500" rx={2}>
                <title>{title}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={cx} y={height + 12} textAnchor="middle" className="fill-slate-400 text-[9px]">
                  {formatHour(p.time)}
                </text>
              )}
              {/* Flecha: waveDir es DE DÓNDE viene; apunta hacia dónde va (+180). */}
              {p.waveDir != null && (
                <g transform={`translate(${cx} ${height + 23}) rotate(${p.waveDir + 180})`}>
                  <title>{`Ola del ${compass(p.waveDir)}`}</title>
                  <path d="M0,-4 L2.8,4 L0,1.6 L-2.8,4 Z" className="fill-cyan-600" />
                </g>
              )}
            </g>
          );
        })}

        {/* Líneas de umbral (precaución/peligro) según la tolerancia */}
        <line x1={padLeft} y1={y(yellow)} x2={width} y2={y(yellow)} className="stroke-amber-400" strokeWidth={1.5} strokeDasharray="5 3" />
        <line x1={padLeft} y1={y(red)} x2={width} y2={y(red)} className="stroke-red-500" strokeWidth={1.5} strokeDasharray="5 3" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-cyan-500" /> Ola (m)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-dashed border-amber-400" /> Precaución ({yellow} m)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-dashed border-red-500" /> Peligro ({red} m)
        </span>
        {hasDir && <span className="text-slate-400">Flecha: hacia dónde va la ola</span>}
      </div>
    </div>
  );
}
