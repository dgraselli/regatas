'use client';

import { useEffect, useRef, useState } from 'react';
import type { HourlyPoint } from '@/lib/types/forecast';
import type { Caution } from '@/lib/profile/types';
import { scoringFor } from '@/lib/config/boat';
import { formatHour, compass } from '@/lib/format';

/**
 * Escala vertical fija (kt). Es constante a propósito: así dos gráficos de días
 * u horas distintas son comparables a simple vista (un día más ventoso se nota
 * porque las barras son más altas, no porque cambie la escala).
 */
const MAX_KT = 45;
const TICKS = [0, 10, 20, 30, 40];

/** Gráfico simple de barras de viento/ráfagas por hora (solo SVG, sin librerías). */
export function HourlyWindChart({
  points,
  caution = 'normal',
}: {
  points: HourlyPoint[];
  caution?: Caution;
}) {
  // Mide el ancho disponible para que el gráfico se ajuste al contenedor.
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

  // Umbrales de ráfaga según la tolerancia elegida: amarilla = precaución, roja = peligro.
  const t = scoringFor(caution);
  const yellow = t.gustYellow;
  const red = t.gustRed;

  const padLeft = 22;
  const gap = 4;
  const minSlot = 12; // ancho mínimo por hora; por debajo de esto, el gráfico scrollea
  const n = points.length;

  // Cada hora ocupa un "slot". Si entran todas en el ancho disponible, se reparten
  // para llenarlo; si no, se usa el mínimo y aparece el scroll horizontal.
  const avail = Math.max(0, containerW - padLeft);
  const slot = Math.max(minSlot, avail / n);
  const barW = Math.max(6, slot - gap);
  const height = 120;
  const width = padLeft + n * slot;
  const labelEvery = slot >= 26 ? 1 : 3;

  // kt → coordenada vertical (escala fija, recortando lo que supere MAX_KT).
  const y = (kt: number) => height - (Math.min(kt, MAX_KT) / MAX_KT) * height;

  return (
    <div ref={wrapRef} className="w-full overflow-x-auto">
      <svg width={width} height={height + 28} className="text-mar-500 max-w-none">
        {/* Eje Y: grilla y escala fija de referencia */}
        {TICKS.map((kt) => (
          <g key={kt}>
            <line x1={padLeft} y1={y(kt)} x2={width} y2={y(kt)} className="stroke-slate-100" strokeWidth={1} />
            <text x={padLeft - 4} y={y(kt) + 3} textAnchor="end" className="fill-slate-300 text-[8px]">
              {kt}
            </text>
          </g>
        ))}

        {/* Barras: ráfaga (claro) detrás, viento (oscuro) adelante */}
        {points.map((p, i) => {
          const x = padLeft + i * slot + (slot - gap - barW) / 2;
          const cx = x + barW / 2;
          const wy = y(p.windKt);
          const gy = y(p.gustKt);
          return (
            <g key={p.time}>
              <rect x={x} y={gy} width={barW} height={height - gy} className="fill-mar-200" rx={2} />
              <rect x={x} y={wy} width={barW} height={height - wy} className="fill-mar-500" rx={2} />
              {i % labelEvery === 0 && (
                <text x={cx} y={height + 12} textAnchor="middle" className="fill-slate-400 text-[9px]">
                  {formatHour(p.time)}
                </text>
              )}
              {i % labelEvery === 0 && (
                <text x={cx} y={height + 24} textAnchor="middle" className="fill-slate-300 text-[8px]">
                  {compass(p.windDir)}
                </text>
              )}
            </g>
          );
        })}

        {/* Líneas de umbral por encima de las barras, para que se lean claras */}
        <line x1={padLeft} y1={y(yellow)} x2={width} y2={y(yellow)} className="stroke-amber-400" strokeWidth={1.5} strokeDasharray="5 3" />
        <line x1={padLeft} y1={y(red)} x2={width} y2={y(red)} className="stroke-red-500" strokeWidth={1.5} strokeDasharray="5 3" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-mar-500" /> Viento (kt)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-mar-200" /> Ráfagas (kt)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-dashed border-amber-400" /> Precaución ({yellow} kt)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-dashed border-red-500" /> Peligro ({red} kt)
        </span>
      </div>
    </div>
  );
}
