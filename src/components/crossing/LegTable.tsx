'use client';

import type { Leg } from '@/lib/types/crossing';
import { compass, formatDuration } from '@/lib/format';
import { pointOfSailLabel } from '@/lib/domain/pointOfSail';

export function LegTable({ legs }: { legs: Leg[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3 font-medium">Tramo</th>
            <th className="py-2 px-3 font-medium">Rumbo</th>
            <th className="py-2 px-3 font-medium">Viento</th>
            <th className="py-2 px-3 font-medium">Amura</th>
            <th className="py-2 px-3 font-medium">Vel.</th>
            <th className="py-2 pl-3 font-medium">Tiempo</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => (
            <tr key={i} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-3">
                <div className="text-slate-700">{leg.fromName} → {leg.toName}</div>
                <div className="text-xs text-slate-400">{leg.distanceNm} NM</div>
              </td>
              <td className="py-2 px-3 text-slate-600">{leg.bearing}°</td>
              <td className="py-2 px-3 text-slate-600">
                {leg.windKt} kt {compass(leg.windDir)}
                {leg.gustKt >= leg.windKt + 1 && (
                  <span className="text-slate-400"> · ráf {leg.gustKt}</span>
                )}
              </td>
              <td className="py-2 px-3">
                <span className="text-slate-700">{pointOfSailLabel(leg.pointOfSail)}</span>
                <div className="text-xs text-slate-400">TWA {leg.twa}°</div>
              </td>
              <td className="py-2 px-3 text-slate-600">{leg.boatKt} kt</td>
              <td className="py-2 pl-3 text-slate-600">{formatDuration(leg.hours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
