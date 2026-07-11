'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { HourlyPoint } from '@/lib/types/forecast';
import { type Caution, DEFAULT_LOW_WIND_KT } from '@/lib/profile/types';
import { scoringFor, DAYLIGHT } from '@/lib/config/boat';
import { sunEvent } from '@/lib/domain/sun';
import { formatHour, compass } from '@/lib/format';
import { FogIcon } from '@/components/common/FogIcon';

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
  location,
  now,
}: {
  points: HourlyPoint[];
  caution?: Caution;
  lowWindKt?: number;
  /** Posición del lugar, para dibujar la campana de horas de luz (amanecer/atardecer). */
  location?: { lat: number; lon: number };
  /**
   * Hora actual ('YYYY-MM-DDTHH:mm', misma zona horaria que `points`). Si cae
   * dentro del día graficado, las horas ya cumplidas se atenúan y una línea
   * vertical con la hora exacta marca el "ahora".
   */
  now?: string;
}) {
  // IDs únicos para los patrones de niebla (por si hay más de un gráfico en la página).
  const uid = useId();
  const neblinaPatternId = `wavy-neblina-${uid}`;
  const nieblaPatternId = `wavy-niebla-${uid}`;
  const fogFadeId = `fog-fade-${uid}`;
  const fogFadeMaskId = `fog-fade-mask-${uid}`;
  const fogHFadeId = `fog-hfade-${uid}`;
  const fogHFadeMaskId = `fog-hfade-mask-${uid}`;

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
  // Ventanas de niebla: horas contiguas con visibilidad reducida, agrupadas para
  // dibujar una banda por ventana (con su degradé), no una por hora. La ventana es
  // "niebla" (más oscura) si su visibilidad mínima cae bajo el umbral rojo.
  const fogWindows: { startIdx: number; endIdx: number; niebla: boolean }[] = [];
  {
    let start = -1;
    let minVis = Infinity;
    const flush = (endIdx: number) => {
      if (start >= 0) fogWindows.push({ startIdx: start, endIdx, niebla: minVis <= t.fogRedM });
      start = -1;
      minVis = Infinity;
    };
    for (let i = 0; i < points.length; i++) {
      const v = points[i].visibilityM;
      if (v != null && v <= t.fogYellowM) {
        if (start < 0) start = i;
        minVis = Math.min(minVis, v);
      } else {
        flush(i - 1);
      }
    }
    flush(points.length - 1);
  }
  // La línea de "poco viento" solo se dibuja si alguna hora cae por debajo del umbral.
  const hasLowWind = points.some((p) => p.windKt < lowWind);

  // Campana de horas de luz: cúpula tenue (amanecer→atardecer, pico al mediodía
  // solar) detrás de las barras, con el amanecer/atardecer REALES de la fecha y el
  // lugar. Sin lugar cae a las horas fijas. Deja ver de un vistazo la franja diurna.
  const dayDate = points[0].time.slice(0, 10);
  const hour0 = Number(points[0].time.slice(11, 13));
  const sunrise = location
    ? sunEvent(dayDate, location.lat, location.lon, true) ?? DAYLIGHT.sunriseHour
    : DAYLIGHT.sunriseHour;
  const sunset = location
    ? sunEvent(dayDate, location.lat, location.lon, false) ?? DAYLIGHT.sunsetHour
    : DAYLIGHT.sunsetHour;
  const cxForHour = (h: number) => padLeft + (h - hour0) * slot + (slot - gap) / 2;
  const domeTopY = 6; // el pico de la campana casi toca el borde superior
  const domeY = (h: number) =>
    height - Math.sin((Math.PI * (h - sunrise)) / (sunset - sunrise)) * (height - domeTopY);
  const domeSteps = 48;
  let domePath = `M ${cxForHour(sunrise).toFixed(1)} ${height}`;
  for (let k = 1; k <= domeSteps; k++) {
    const h = sunrise + ((sunset - sunrise) * k) / domeSteps;
    domePath += ` L ${cxForHour(h).toFixed(1)} ${domeY(h).toFixed(1)}`;
  }
  domePath += ' Z';

  // Indicador de hora actual (solo si el gráfico es del día de hoy): las horas
  // ya cumplidas se atenúan en gris y una línea con la hora exacta marca el
  // "ahora". `nowH` es la hora local en decimal (14:32 → 14.53).
  const nowH =
    now && now.slice(0, 10) === dayDate
      ? Number(now.slice(11, 13)) + Number(now.slice(14, 16)) / 60
      : null;
  const isPastHour = (i: number) => nowH != null && hour0 + i + 1 <= nowH;
  const xNow = nowH != null ? cxForHour(nowH) : 0;
  const showNow = nowH != null && xNow >= padLeft && xNow <= width;
  const topPad = showNow ? 16 : 0; // lugar para el rótulo con la hora
  const chipW = 34;
  const chipX = Math.min(Math.max(xNow - chipW / 2, padLeft), width - chipW);

  return (
    <div ref={wrapRef} className="w-full overflow-x-auto">
      <svg width={width} height={height + 34 + topPad} className="text-mar-500 max-w-none">
        {/* Patrones de "niebla" (líneas onduladas): más densas y oscuras para niebla
            cerrada, más espaciadas y claras para neblina/visibilidad reducida. */}
        <defs>
          <pattern id={neblinaPatternId} width="10" height="6" patternUnits="userSpaceOnUse">
            <path d="M0,3 Q2.5,0.5 5,3 T10,3" fill="none" stroke="#94a3b8" strokeWidth={1} />
          </pattern>
          <pattern id={nieblaPatternId} width="8" height="4.5" patternUnits="userSpaceOnUse">
            <path d="M0,2.25 Q2,0.4 4,2.25 T8,2.25" fill="none" stroke="#475569" strokeWidth={1.15} />
          </pattern>
          {/* Degradé vertical: la niebla se ve opaca arriba y se desvanece hacia abajo. */}
          <linearGradient id={fogFadeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity={1} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </linearGradient>
          <mask id={fogFadeMaskId}>
            <rect x={0} y={0} width={width} height={height} fill={`url(#${fogFadeId})`} />
          </mask>
          {/* Degradé horizontal por ventana: transparente en los bordes, opaco al
              centro. En unidades relativas (0..1) para que se adapte al ancho de
              cada ventana de niebla. */}
          <linearGradient id={fogHFadeId}>
            <stop offset="0%" stopColor="white" stopOpacity={0.1} />
            <stop offset="50%" stopColor="white" stopOpacity={1} />
            <stop offset="100%" stopColor="white" stopOpacity={0.1} />
          </linearGradient>
          <mask id={fogHFadeMaskId} maskContentUnits="objectBoundingBox">
            <rect x={0} y={0} width={1} height={1} fill={`url(#${fogHFadeId})`} />
          </mask>
        </defs>

        {/* Todo el dibujo baja `topPad` px cuando hay rótulo de hora actual. */}
        <g transform={`translate(0 ${topPad})`}>

        {/* Eje Y: grilla y escala fija de referencia */}
        {TICKS.map((kt) => (
          <g key={kt}>
            <line x1={padLeft} y1={y(kt)} x2={width} y2={y(kt)} className="stroke-slate-100" strokeWidth={1} />
            <text x={padLeft - 4} y={y(kt) + 3} textAnchor="end" className="fill-slate-300 text-[8px]">
              {kt}
            </text>
          </g>
        ))}

        {/* Campana de horas de luz (detrás de todo): franja diurna amanecer→atardecer. */}
        <path d={domePath} className="fill-amber-200 stroke-amber-300" opacity={0.35} strokeWidth={1} />

        {/* Bandas de visibilidad reducida (detrás de las barras): una por ventana de
            niebla. Se dibujan con ondas (no una sombra sólida) para leer de un vistazo
            cuándo cae la visibilidad, consistente con las tarjetas. Doble degradé:
            vertical (opaco arriba → transparente abajo) sobre el grupo, y horizontal
            (transparente en los bordes → opaco al centro) sobre la banda. */}
        {fogWindows.map((w) => (
          <g key={`vis-${w.startIdx}`} mask={`url(#${fogFadeMaskId})`}>
            <rect
              x={padLeft + w.startIdx * slot}
              y={0}
              width={(w.endIdx - w.startIdx + 1) * slot}
              height={height}
              fill={w.niebla ? `url(#${nieblaPatternId})` : `url(#${neblinaPatternId})`}
              opacity={w.niebla ? 0.7 : 0.6}
              mask={`url(#${fogHFadeMaskId})`}
            />
          </g>
        ))}

        {/* Barras + hora + flecha de dirección (hacia dónde sopla) en cada hora */}
        {points.map((p, i) => {
          const x = padLeft + i * slot + (slot - gap - barW) / 2;
          const cx = x + barW / 2;
          const wy = y(p.windKt);
          const gy = y(p.gustKt);
          const past = isPastHour(i); // hora ya cumplida: se dibuja atenuada en gris
          return (
            <g key={p.time}>
              <rect x={x} y={gy} width={barW} height={height - gy} className={past ? 'fill-slate-200' : 'fill-mar-200'} rx={2} />
              <rect x={x} y={wy} width={barW} height={height - wy} className={past ? 'fill-slate-300' : 'fill-mar-500'} rx={2} />
              {i % labelEvery === 0 && (
                <text x={cx} y={height + 12} textAnchor="middle" className={`${past ? 'fill-slate-300' : 'fill-slate-400'} text-[9px]`}>
                  {formatHour(p.time)}
                </text>
              )}
              {/* Flecha: windDir es DE DÓNDE viene; apunta hacia dónde sopla (+180). */}
              <g transform={`translate(${cx} ${height + 23}) rotate(${p.windDir + 180})`}>
                <title>{`Viento del ${compass(p.windDir)}`}</title>
                <path d="M0,-5 L3.4,5 L0,2 L-3.4,5 Z" className={past ? 'fill-slate-300' : 'fill-mar-500'} />
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

        {/* Línea de "ahora" con la hora exacta en un rótulo arriba. */}
        {showNow && (
          <g>
            <line x1={xNow} y1={-1} x2={xNow} y2={height} className="stroke-slate-600" strokeWidth={1.5} />
            <circle cx={xNow} cy={height} r={2.5} className="fill-slate-600" />
            <rect x={chipX} y={-15} width={chipW} height={13} rx={6.5} className="fill-slate-600" />
            <text x={chipX + chipW / 2} y={-5.5} textAnchor="middle" className="fill-white text-[8.5px] font-semibold">
              {now!.slice(11, 16)}
            </text>
          </g>
        )}
        </g>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-t-full bg-amber-200/80 border-t border-amber-300" /> Horas de luz
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-mar-500" /> Viento (kt)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-mar-200" /> Ráfagas (kt)
        </span>
        {showNow && (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-slate-300" /> Horas pasadas
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-4 border-t-2 border-slate-600" /> Ahora ({now!.slice(11, 16)})
            </span>
          </>
        )}
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
            <FogIcon dense={false} className="h-3 w-4" /> Visibilidad reducida
          </span>
        )}
        {hasNiebla && (
          <span className="inline-flex items-center gap-1">
            <FogIcon dense className="h-3 w-4" /> Niebla
          </span>
        )}
      </div>
    </div>
  );
}
