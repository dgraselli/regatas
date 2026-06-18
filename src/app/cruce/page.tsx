'use client';

import { useState } from 'react';
import { useCrossingPlan } from '@/lib/hooks/useCrossingPlan';
import { DEFAULT_ROUTE_ID, getRoute } from '@/lib/config/routes';
import { DepartureRanker } from '@/components/crossing/DepartureRanker';
import { LegTable } from '@/components/crossing/LegTable';
import { RouteMap } from '@/components/crossing/RouteMap';
import { Card, CardHeader } from '@/components/ui/Card';
import { Loading, ErrorState } from '@/components/ui/States';
import { formatDate, formatHour, formatDuration } from '@/lib/format';

export default function CrucePage() {
  const routeId = DEFAULT_ROUTE_ID;
  const route = getRoute(routeId);
  const { data, isLoading, isError, error } = useCrossingPlan(routeId);
  const [selected, setSelected] = useState(0);

  const candidate = data?.ranked[selected];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Cruce {route.name}</h1>
        <p className="text-slate-500 text-sm">
          Mejor hora de salida según el viento (~{route.approxNm} NM). Se evalúa la derrota
          fija a distintas horas y se rankea por tiempo y seguridad.
        </p>
      </div>

      {isLoading && <Loading label="Calculando planes de cruce…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}

      {data && data.ranked.length > 0 && (
        <>
          <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
            <Card className="p-4">
              <h2 className="font-semibold text-slate-700 mb-2">Opciones de salida</h2>
              <DepartureRanker
                candidates={data.ranked}
                selectedIndex={selected}
                onSelect={setSelected}
              />
            </Card>
            <Card className="p-4 flex justify-center">
              <RouteMap route={route} />
            </Card>
          </div>

          {candidate && (
            <Card>
              <CardHeader
                title={`Salir ${formatDate(candidate.departAt)} a las ${formatHour(candidate.departAt)}`}
                subtitle={`Llegada estimada ${formatHour(candidate.arriveAt)} · duración ${formatDuration(
                  candidate.totalHours,
                )}`}
              />
              <div className="px-4 pb-4 pt-3 space-y-4">
                {candidate.warnings.length > 0 && (
                  <ul className="space-y-1">
                    {candidate.warnings.map((w, i) => (
                      <li
                        key={i}
                        className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5"
                      >
                        ⚠️ {w}
                      </li>
                    ))}
                  </ul>
                )}
                <LegTable legs={candidate.legs} />
              </div>
            </Card>
          )}
        </>
      )}

      {data && data.ranked.length === 0 && (
        <ErrorState message="No hay ventanas de salida en el horizonte del pronóstico." />
      )}
    </div>
  );
}
