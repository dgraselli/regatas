'use client';

import type { Route } from '@/lib/types/config';

/** Mini-mapa esquemático (SVG) de los waypoints de la ruta. */
export function RouteMap({ route }: { route: Route }) {
  const pts = route.waypoints;
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const w = 280;
  const h = 200;
  const pad = 30;

  const sx = (lon: number) =>
    pad + ((lon - minLon) / (maxLon - minLon || 1)) * (w - 2 * pad);
  // lat: mayor (norte) arriba
  const sy = (lat: number) =>
    pad + ((maxLat - lat) / (maxLat - minLat || 1)) * (h - 2 * pad);

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.lon)},${sy(p.lat)}`).join(' ');

  return (
    <svg width={w} height={h} className="max-w-full rounded-lg bg-mar-50">
      <path d={path} fill="none" className="stroke-mar-400" strokeWidth={2} strokeDasharray="4 3" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.lon)} cy={sy(p.lat)} r={5} className={i === 0 || i === pts.length - 1 ? 'fill-mar-700' : 'fill-mar-300'} />
          <text
            x={sx(p.lon)}
            y={sy(p.lat) - 9}
            textAnchor="middle"
            className="fill-slate-500 text-[9px]"
          >
            {p.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
