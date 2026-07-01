'use client';

import type { Leg } from '@/lib/types/crossing';
import type { Propulsion } from '@/lib/types/config';
import { formatHour } from '@/lib/format';
import { WindArrow } from '@/components/common/WindArrow';
import { pointOfSailLabel, seaSectorLabel } from '@/lib/domain/pointOfSail';

export function LegTable({ legs, propulsion = 'vela' }: { legs: Leg[]; propulsion?: Propulsion }) {
  const isMotor = propulsion === 'motor';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3 font-medium">Hora</th>
            <th className="py-2 px-3 font-medium">Viento</th>
            <th className="py-2 px-3 font-medium">{isMotor ? 'Mar' : 'Amura'}</th>
            <th className="py-2 px-3 font-medium">Vel.</th>
            <th className="py-2 pl-3 font-medium">Avance</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => (
            <tr key={i} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-3 text-slate-700">{formatHour(leg.time)}</td>
              <td className="py-2 px-3 text-slate-600">
                <span className="inline-flex items-center gap-1">
                  {leg.windKt} kt <WindArrow deg={leg.windDir} />
                </span>
                {leg.gustKt >= leg.windKt + 1 && (
                  <span className="text-slate-400"> · ráf {leg.gustKt}</span>
                )}
              </td>
              <td className="py-2 px-3">
                <span className="text-slate-700">
                  {isMotor ? seaSectorLabel(leg.pointOfSail) : pointOfSailLabel(leg.pointOfSail)}
                </span>
                <div className="text-xs text-slate-400">TWA {leg.twa}°</div>
              </td>
              <td className="py-2 px-3 text-slate-600">{leg.boatKt} kt</td>
              <td className="py-2 pl-3 text-slate-600">
                {leg.cumulativeNm} NM
                <span className="text-xs text-slate-400"> (+{leg.segmentNm})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
