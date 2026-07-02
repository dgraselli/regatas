'use client';

import { useEffect, useRef, useState } from 'react';
import type { HourlyPoint } from '@/lib/types/forecast';
import { type Caution, DEFAULT_LOW_WIND_KT } from '@/lib/profile/types';
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
  lowWindKt,
}: {
  points: HourlyPoint[];
  caution?: Caution;
  lowWindKt?: number;
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
  const lowWind = lowWindKt ?? DEFAULT_LOW_WIND_KT; // umbral de "poco viento"

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

  // Visibilidad: marcamos solo las horas con visibilidad reducida (neblina) o niebla.
  const hasNeblina = points.some(
    (p) => p.visibilityM != null && p.visibilityM <= t.fogYellowM && p.visibilityM > t.fogRedM,
  );
  const hasNiebla = points.some((p) => p.visibilityM != null && p.visibilityM <= t.fogRedM);
  // La línea de "poco viento" solo se dibuja si alguna hora cae por debajo del umbral.
  const hasLowWind = points.some((p) => p.windKt < lowWind);

  return (
    <div ref={wrapRef} className="w-full overflow-x-auto">
      <svg width={width} height={height + 34} className="text-mar-500 max-w-none">
        {/* Eje Y: grilla y escala fija de referencia */}
        {TICKS.map((kt) => (
          <g key={kt}>
            <line x1={padLeft} y1={y(kt)} x2={width} y2={y(kt)} className="stroke-slate-100" strokeWidth={1} />
            <text x={padLeft - 4} y={y(kt) + 3} textAnchor="end" className="fill-slate-300 text-[8px]">
              {kt}
            </text>
          </g>
        ))}

        {/* Bandas de visibilidad reducida (detrás de las barras): solo en las horas
            con neblina/niebla, para identificar de un vistazo cuándo cae la visibilidad. */}
        {points.map((p, i) => {
          const v = p.visibilityM;
          if (v == null || v > t.fogYellowM) return null;
          const niebla = v <= t.fogRedM;
          return (
            <rect
              key={`vis-${p.time}`}
              x={padLeft + i * slot}
              y={0}
              width={slot}
              height={height}
              className={niebla ? 'fill-slate-500' : 'fill-slate-300'}
              opacity={0.35}
            />
          );
        })}

        {/* Barras + hora + flecha de dirección (hacia dónde sopla) en cada hora */}
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
              {/* Flecha: windDir es DE DÓNDE viene; apunta hacia dónde sopla (+180). */}
              <g transform={`translate(${cx} ${height + 23}) rotate(${p.windDir + 180})`}>
                <title>{`Viento del ${compass(p.windDir)}`}</title>
                <path d="M0,-5 L3.4,5 L0,2 L-3.4,5 Z" className="fill-mar-500" />
              </g>
            </g>
          );
        })}

        {/* Líneas de umbral por encima de las barras, para que se lean claras */}
        {hasLowWind && (
          <line x1={padLeft} y1={y(lowWind)} x2={width} y2={y(lowWind)} className="stroke-blue-500" strokeWidth={1.5} strokeDasharray="5 3" />
        )}
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
        {hasLowWind && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-dashed border-blue-500" /> Poco viento ({lowWind} kt)
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-dashed border-amber-400" /> Precaución ({yellow} kt)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-dashed border-red-500" /> Peligro ({red} kt)
        </span>
        {hasNeblina && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-slate-300/70" /> Visibilidad reducida
          </span>
        )}
        {hasNiebla && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-slate-500/70" /> Niebla
          </span>
        )}
      </div>
    </div>
  );
}
