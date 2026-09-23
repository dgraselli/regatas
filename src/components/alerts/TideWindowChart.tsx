'use client';

import { useEffect, useRef, useState } from 'react';
import type { TideWindow } from '@/lib/domain/tideWindow';
import { formatDateShort, formatHour, parseLocalIso } from '@/lib/format';

/**
 * Curva única de nivel: de dónde viene la marea y hacia dónde va, con el rango
 * seguro de la amarra encima, para responder "¿hasta qué hora puedo salir?" de
 * un vistazo.
 *
 * Es un solo dato y va en un solo gráfico: lo medido en línea llena y sin banda,
 * lo estimado punteado y con la banda de incertidumbre sombreada. El corte entre
 * los dos es visible porque ahí está el límite real del conocimiento: el INA
 * publica con 1 a 2 h de atraso y no hay forma de saber el presente con menos de
 * ~15 cm de error (ver `tideWindow.ts`).
 */
export function TideWindowChart({
  win,
  now,
  safeMinM,
  safeMaxM,
}: {
  win: TideWindow;
  /** Hora actual naive ('YYYY-MM-DDTHH:mm'), para la línea del ahora. */
  now: string;
  safeMinM?: number;
  safeMaxM?: number;
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

  const pts = win.points;
  if (pts.length < 2) return null;

  const padLeft = 34;
  const height = 96;
  const width = Math.max(240, containerW);
  const plotW = width - padLeft;

  // La escala incluye la banda y los umbrales, para que nada quede fuera del cuadro.
  const candidates = [
    ...pts.map((p) => p.heightM + p.uncertaintyM),
    ...pts.map((p) => p.heightM - p.uncertaintyM),
    ...(safeMinM != null ? [safeMinM] : []),
    ...(safeMaxM != null ? [safeMaxM] : []),
  ];
  const lo = Math.min(...candidates);
  const hi = Math.max(...candidates);
  const span = hi - lo || 1;
  const pad = span * 0.1;
  const yFor = (m: number) => height - ((m - lo + pad) / (span + 2 * pad)) * height;
  const xFor = (i: number) => padLeft + (i / (pts.length - 1)) * plotW;

  const line = (sel: (i: number) => number, from: number, to: number) =>
    pts
      .slice(from, to)
      .map((_, k) => `${k === 0 ? 'M' : 'L'}${xFor(from + k).toFixed(1)},${sel(from + k).toFixed(1)}`)
      .join(' ');

  // El corte entre medido y estimado: primer punto que ya no es medición.
  const firstEstimated = pts.findIndex((p) => p.source !== 'medido');
  const cut = firstEstimated === -1 ? pts.length : firstEstimated;

  const y = (i: number) => yFor(pts[i].heightM);
  // La banda se dibuja como un polígono: borde superior de ida, inferior de vuelta.
  const bandPts = pts.slice(cut);
  const bandFrom = Math.max(0, cut - 1); // arranca en el último medido para que no haya salto
  const band =
    bandPts.length > 1
      ? [
          ...pts
            .slice(bandFrom)
            .map(
              (p, k) =>
                `${k === 0 ? 'M' : 'L'}${xFor(bandFrom + k).toFixed(1)},${yFor(p.heightM + p.uncertaintyM).toFixed(1)}`,
            ),
          ...pts
            .slice(bandFrom)
            .reverse()
            .map(
              (p, k) =>
                `L${xFor(pts.length - 1 - k).toFixed(1)},${yFor(p.heightM - p.uncertaintyM).toFixed(1)}`,
            ),
          'Z',
        ].join(' ')
      : '';

  // Índice fraccionario del ahora: si son las 10:20 la línea va entre las 10 y
  // las 11, no pegada a la hora siguiente.
  const t0 = parseLocalIso(pts[0].time);
  const nowMs = parseLocalIso(now);
  const nowIdx = t0 != null && nowMs != null ? (nowMs - t0) / 3_600_000 : -1;
  const nowVisible = nowIdx >= 0 && nowIdx <= pts.length - 1;
  // Cuántas horas saltear entre rótulos: se calcula con el ancho real en vez de
  // un paso fijo, porque en un celular (~300 px útiles) un paso de 3 h encimaba
  // las etiquetas y en escritorio (~800 px) desperdiciaba lugar.
  const pxPerHour = plotW / Math.max(1, pts.length - 1);
  const labelEvery = Math.max(1, Math.ceil(30 / pxPerHour));

  // Referencias de altura (m). Sin esto, y si la amarra no tiene niveles seguros
  // definidos, el eje Y no daría ninguna escala y la curva sería sólo una forma.
  const yTicks = [hi, (hi + lo) / 2, lo];

  // Cambios de día: la curva cubre más de 24 h, así que la hora sola no ubica.
  const dayTicks = pts.reduce<{ i: number; time: string }[]>((acc, p, i) => {
    if (i > 0 && p.time.slice(0, 10) !== pts[i - 1].time.slice(0, 10)) acc.push({ i, time: p.time });
    return acc;
  }, []);

  return (
    <div ref={wrapRef} className="w-full">
      <svg width={width} height={height + 18} className="max-w-full">
        {/* Escala de altura: líneas guía y metros, igual que el gráfico de nivel. */}
        {yTicks.map((m, i) => (
          <g key={`y${i}`}>
            <line
              x1={padLeft}
              y1={yFor(m)}
              x2={width}
              y2={yFor(m)}
              className="stroke-slate-100"
              strokeWidth={1}
            />
            <text
              x={padLeft - 4}
              y={yFor(m) + 3}
              textAnchor="end"
              className="fill-slate-400 text-[9px]"
            >
              {m.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Rango seguro de la amarra: todo lo que quede fuera es problema. */}
        {safeMinM != null && (
          <>
            <line
              x1={padLeft}
              y1={yFor(safeMinM)}
              x2={width}
              y2={yFor(safeMinM)}
              className="stroke-red-400"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text x={width - 2} y={yFor(safeMinM) - 3} textAnchor="end" className="fill-red-500 text-[9px]">
              mín {safeMinM.toFixed(2)}
            </text>
          </>
        )}
        {safeMaxM != null && (
          <>
            <line
              x1={padLeft}
              y1={yFor(safeMaxM)}
              x2={width}
              y2={yFor(safeMaxM)}
              className="stroke-red-400"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            {/* Debajo de su línea: el máximo suele coincidir con el techo de la
                escala y arriba quedaba cortado contra el borde del SVG. */}
            <text x={width - 2} y={yFor(safeMaxM) + 10} textAnchor="end" className="fill-red-500 text-[9px]">
              máx {safeMaxM.toFixed(2)}
            </text>
          </>
        )}

        {band && <path d={band} className="fill-mar-200/50" />}
        {cut > 1 && <path d={line(y, 0, cut)} fill="none" className="stroke-mar-600" strokeWidth={2} />}
        {cut < pts.length && (
          <path
            d={line(y, Math.max(0, cut - 1), pts.length)}
            fill="none"
            className="stroke-mar-500"
            strokeWidth={2}
            strokeDasharray="5 3"
          />
        )}

        {nowVisible && (
          <line
            x1={xFor(nowIdx)}
            y1={0}
            x2={xFor(nowIdx)}
            y2={height}
            className="stroke-slate-400"
            strokeWidth={1}
          />
        )}

        {dayTicks.map((d) => (
          <g key={`d${d.time}`}>
            <line
              x1={xFor(d.i)}
              y1={0}
              x2={xFor(d.i)}
              y2={height}
              className="stroke-slate-200"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={xFor(d.i)}
              y={height + 13}
              textAnchor="middle"
              className="fill-slate-500 text-[9px] font-medium"
            >
              {formatDateShort(d.time)}
            </text>
          </g>
        ))}

        {pts.map((p, i) =>
          // La hora se saltea donde va el rótulo de fecha, para no encimarlos.
          i % labelEvery === 0 && !dayTicks.some((d) => Math.abs(d.i - i) < labelEvery) ? (
            <text
              key={p.time}
              x={xFor(i)}
              y={height + 13}
              textAnchor="middle"
              className="fill-slate-400 text-[9px]"
            >
              {formatHour(p.time)}
            </text>
          ) : null,
        )}
      </svg>

      <p className="mt-1 text-xs text-slate-400">
        Altura en metros · línea llena = medido por el mareógrafo · punteado y sombreado =
        estimado (± margen de error) · la vertical gris es ahora
        {safeMinM != null || safeMaxM != null ? ' · rojo = tu rango seguro' : ''}
      </p>
    </div>
  );
}
