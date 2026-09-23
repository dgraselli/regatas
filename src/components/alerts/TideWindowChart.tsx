'use client';

import { useEffect, useRef, useState } from 'react';
import type { TideWindow } from '@/lib/domain/tideWindow';
import { formatHour, parseLocalIso } from '@/lib/format';

/**
 * Curva de nivel de las próximas horas con el rango seguro de la amarra dibujado
 * encima, para responder "¿hasta qué hora puedo salir?" de un vistazo.
 *
 * Lo medido tiene línea llena y sin banda; lo estimado va punteado y con la
 * banda de incertidumbre sombreada, porque a partir de ahí la app está
 * estimando: el INA publica el nivel con 1 a 2 h de atraso y no hay forma de
 * saber el presente con menos de ~15 cm de error (ver `tideWindow.ts`).
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
  const labelEvery = plotW / pts.length >= 26 ? 2 : 3;

  return (
    <div ref={wrapRef} className="w-full">
      <svg width={width} height={height + 18} className="max-w-full">
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
            <text x={padLeft - 4} y={yFor(safeMinM) + 3} textAnchor="end" className="fill-red-500 text-[9px]">
              {safeMinM.toFixed(2)}
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
            <text x={padLeft - 4} y={yFor(safeMaxM) + 3} textAnchor="end" className="fill-red-500 text-[9px]">
              {safeMaxM.toFixed(2)}
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

        {pts.map((p, i) =>
          i % labelEvery === 0 ? (
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
        Línea llena = medido · punteado y sombreado = estimado (± margen de error)
        {safeMinM != null || safeMaxM != null ? ' · rojo = tu rango seguro' : ''}
      </p>
    </div>
  );
}
