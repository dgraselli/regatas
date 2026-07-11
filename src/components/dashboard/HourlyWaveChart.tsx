'use client';

import { useEffect, useRef, useState } from 'react';
import type { HourlyPoint } from '@/lib/types/forecast';
import { type Caution } from '@/lib/profile/types';
import { scoringFor, DAYLIGHT } from '@/lib/config/boat';
import { sunEvent } from '@/lib/domain/sun';
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
  location,
  now,
}: {
  points: HourlyPoint[];
  caution?: Caution;
  /** Posición del lugar, para dibujar la campana de horas de luz (amanecer/atardecer). */
  location?: { lat: number; lon: number };
  /**
   * Hora actual ('YYYY-MM-DDTHH:mm', misma zona horaria que `points`). Si cae
   * dentro del día graficado, las horas ya cumplidas se atenúan y una línea
   * vertical marca el "ahora" (sin rótulo: lo lleva el gráfico de viento de
   * arriba, con el que comparte layout).
   */
  now?: string;
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

  // Campana de horas de luz (igual que el gráfico de viento): amanecer/atardecer
  // reales de la fecha y el lugar; sin lugar cae a las horas fijas.
  const dayDate = points[0].time.slice(0, 10);
  const hour0 = Number(points[0].time.slice(11, 13));
  const sunrise = location
    ? sunEvent(dayDate, location.lat, location.lon, true) ?? DAYLIGHT.sunriseHour
    : DAYLIGHT.sunriseHour;
  const sunset = location
    ? sunEvent(dayDate, location.lat, location.lon, false) ?? DAYLIGHT.sunsetHour
    : DAYLIGHT.sunsetHour;
  const cxForHour = (h: number) => padLeft + (h - hour0) * slot + (slot - gap) / 2;
  const domeTopY = 4;
  const domeY = (h: number) =>
    height - Math.sin((Math.PI * (h - sunrise)) / (sunset - sunrise)) * (height - domeTopY);
  const domeSteps = 48;
  let domePath = `M ${cxForHour(sunrise).toFixed(1)} ${height}`;
  for (let k = 1; k <= domeSteps; k++) {
    const h = sunrise + ((sunset - sunrise) * k) / domeSteps;
    domePath += ` L ${cxForHour(h).toFixed(1)} ${domeY(h).toFixed(1)}`;
  }
  domePath += ' Z';

  // Indicador de hora actual (solo si el gráfico es del día de hoy), igual que
  // en el gráfico de viento: horas cumplidas en gris + línea vertical.
  const nowH =
    now && now.slice(0, 10) === dayDate
      ? Number(now.slice(11, 13)) + Number(now.slice(14, 16)) / 60
      : null;
  const isPastHour = (i: number) => nowH != null && hour0 + i + 1 <= nowH;
  const xNow = nowH != null ? cxForHour(nowH) : 0;
  const showNow = nowH != null && xNow >= padLeft && xNow <= width;

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

        {/* Campana de horas de luz (detrás de las barras): franja diurna amanecer→atardecer. */}
        <path d={domePath} className="fill-amber-200 stroke-amber-300" opacity={0.35} strokeWidth={1} />

        {/* Barras de altura de ola + hora + flecha de dirección (hacia dónde va la ola) */}
        {points.map((p, i) => {
          if (p.waveHeightM == null) return null;
          const x = padLeft + i * slot + (slot - gap - barW) / 2;
          const cx = x + barW / 2;
          const hy = y(p.waveHeightM);
          const past = isPastHour(i); // hora ya cumplida: se dibuja atenuada en gris
          const title =
            `Ola ${p.waveHeightM.toFixed(1)} m` +
            (p.waveDir != null ? ` del ${compass(p.waveDir)}` : '') +
            (p.wavePeriodS != null ? ` · período ${Math.round(p.wavePeriodS)} s` : '');
          return (
            <g key={p.time}>
              <rect x={x} y={hy} width={barW} height={height - hy} className={past ? 'fill-slate-300' : 'fill-cyan-500'} rx={2}>
                <title>{title}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={cx} y={height + 12} textAnchor="middle" className={`${past ? 'fill-slate-300' : 'fill-slate-400'} text-[9px]`}>
                  {formatHour(p.time)}
                </text>
              )}
              {/* Flecha: waveDir es DE DÓNDE viene; apunta hacia dónde va (+180). */}
              {p.waveDir != null && (
                <g transform={`translate(${cx} ${height + 23}) rotate(${p.waveDir + 180})`}>
                  <title>{`Ola del ${compass(p.waveDir)}`}</title>
                  <path d="M0,-4 L2.8,4 L0,1.6 L-2.8,4 Z" className={past ? 'fill-slate-300' : 'fill-cyan-600'} />
                </g>
              )}
            </g>
          );
        })}

        {/* Líneas de umbral (precaución/peligro) según la tolerancia */}
        <line x1={padLeft} y1={y(yellow)} x2={width} y2={y(yellow)} className="stroke-amber-400" strokeWidth={1.5} strokeDasharray="5 3" />
        <line x1={padLeft} y1={y(red)} x2={width} y2={y(red)} className="stroke-red-500" strokeWidth={1.5} strokeDasharray="5 3" />

        {/* Línea de "ahora" (el rótulo con la hora lo lleva el gráfico de viento). */}
        {showNow && (
          <>
            <line x1={xNow} y1={0} x2={xNow} y2={height} className="stroke-slate-600" strokeWidth={1.5} />
            <circle cx={xNow} cy={height} r={2.5} className="fill-slate-600" />
          </>
        )}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-t-full bg-amber-200/80 border-t border-amber-300" /> Horas de luz
        </span>
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
