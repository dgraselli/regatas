'use client';

import { useState, useEffect } from 'react';
import { useCrossingPlan } from '@/lib/hooks/useCrossingPlan';
import { useProfile } from '@/lib/profile/ProfileContext';
import { DepartureRanker } from '@/components/crossing/DepartureRanker';
import { LegTable } from '@/components/crossing/LegTable';
import { LocationPicker } from '@/components/common/LocationPicker';
import { BoatPicker } from '@/components/common/BoatPicker';
import { CautionPicker } from '@/components/common/CautionPicker';
import { Onboarding } from '@/components/common/Onboarding';
import { Card, CardHeader } from '@/components/ui/Card';
import { Loading, ErrorState } from '@/components/ui/States';
import { buildRoute } from '@/lib/config/routes';
import { formatDate, formatHour, formatDuration, compass } from '@/lib/format';
import { track } from '@/lib/analytics';

export default function CrucePage() {
  const { profile, hydrated, activeBoat, activeLocation, setCaution, setCrossingSelection } =
    useProfile();
  const locations = profile.locations;
  const boats = profile.boats;

  const [originId, setOriginId] = useState<string | null>(null);
  const [destId, setDestId] = useState<string | null>(null);
  const [boatId, setBoatId] = useState<string | null>(null);
  // null = mostrar la salida recomendada (best); si no, el índice elegido en la lista.
  const [selected, setSelected] = useState<number | null>(null);

  // Defaults: primero la última selección guardada (si sigue existiendo); si no,
  // origen = amarra activa, destino = primer 'destino' distinto, barco activo.
  useEffect(() => {
    if (!hydrated) return;
    const saved = profile.crossing;
    const validLoc = (id?: string | null) => (id && locations.some((l) => l.id === id) ? id : null);
    const validBoat = (id?: string | null) => (id && boats.some((b) => b.id === id) ? id : null);
    if (!originId) {
      setOriginId(validLoc(saved?.originId) ?? activeLocation?.id ?? locations[0]?.id ?? null);
    }
    if (!destId) {
      const savedDest = validLoc(saved?.destId);
      const dest = locations.find((l) => l.kind === 'destino' && l.id !== activeLocation?.id);
      setDestId(savedDest ?? dest?.id ?? locations.find((l) => l.id !== activeLocation?.id)?.id ?? null);
    }
    if (!boatId) setBoatId(validBoat(saved?.boatId) ?? activeBoat?.id ?? boats[0]?.id ?? null);
  }, [hydrated, profile.crossing, activeLocation, locations, boats, activeBoat, originId, destId, boatId]);

  const from = locations.find((l) => l.id === originId) ?? null;
  const to = locations.find((l) => l.id === destId) ?? null;
  const boat = boats.find((b) => b.id === boatId) ?? activeBoat ?? boats[0] ?? null;

  const { data, isLoading, isError, error } = useCrossingPlan(from, to, boat, profile.caution);
  const isMotor = (boat?.propulsion ?? 'vela') === 'motor';
  // La lista va en orden cronológico; el "mejor" (best) puede estar en cualquier lugar.
  const bestIndex = data ? data.ranked.findIndex((c) => c.departAt === data.best?.departAt) : -1;
  const effIndex = selected ?? (bestIndex >= 0 ? bestIndex : 0);
  const candidate = data?.ranked[effIndex];
  const route = from && to ? buildRoute(from, to) : null;

  if (!hydrated) return <Loading />;

  if (boats.length === 0) {
    return (
      <Onboarding
        title="Asociá tu barco"
        body="El planificador estima tiempos y rumbos según tu barco: con la polar del velero (según su eslora) o a velocidad de crucero si es a motor. Agregá tu barco para empezar."
      />
    );
  }

  if (locations.length < 2) {
    return (
      <Onboarding
        title="Cargá al menos dos lugares"
        body="Necesitás un punto de salida y un destino para planificar un cruce. Agregalos en tu perfil."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Planificador de cruce</h1>
        <p className="text-slate-500 text-sm">
          Mejor hora de salida según el viento,{' '}
          {isMotor ? 'a velocidad de crucero del' : 'con la polar del'}{' '}
          <strong>{boat?.name ?? 'barco'}</strong>
          {route ? ` (~${route.approxNm} NM)` : ''}. Se evalúa la derrota a distintas horas
          y se rankea por tiempo y seguridad.
        </p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <LocationPicker
          label="Salida:"
          locations={locations}
          value={originId}
          onChange={(id) => {
            setOriginId(id);
            setCrossingSelection({ originId: id });
            // Si el nuevo origen coincide con el destino, corré el destino a otro lugar.
            if (id === destId) {
              const newDest = locations.find((l) => l.id !== id)?.id ?? null;
              setDestId(newDest);
              setCrossingSelection({ destId: newDest });
            }
            setSelected(null);
          }}
        />
        <LocationPicker
          label="Destino:"
          locations={locations.filter((l) => l.id !== originId)}
          value={destId}
          onChange={(id) => {
            setDestId(id);
            setCrossingSelection({ destId: id });
            setSelected(null);
          }}
        />
        {boats.length > 1 && (
          <BoatPicker
            boats={boats}
            value={boatId}
            onChange={(id) => {
              setBoatId(id);
              setCrossingSelection({ boatId: id });
              setSelected(null);
            }}
          />
        )}
        <CautionPicker
          value={profile.caution}
          onChange={(c) => {
            setCaution(c);
            track('change_caution', { caution: c, where: 'cruce' });
            setSelected(null);
          }}
        />
      </div>

      {from && to && from.id === to.id && (
        <ErrorState message="La salida y el destino son el mismo lugar." />
      )}

      {isLoading && <Loading label="Calculando planes de cruce…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}

      {data && data.ranked.length > 0 && (
        <>
          <Card className="p-4">
            <h2 className="font-semibold text-slate-700 mb-2">Opciones de salida</h2>
            <DepartureRanker
              candidates={data.ranked}
              selectedIndex={effIndex}
              bestIndex={bestIndex}
              onSelect={(i) => {
                setSelected(i);
                track('crossing_select_departure', { index: i });
              }}
            />
          </Card>

          {candidate && (
            <Card>
              <CardHeader
                title={`Salir ${formatDate(candidate.departAt)} a las ${formatHour(candidate.departAt)}`}
                subtitle={
                  candidate.completes
                    ? `Rumbo ${candidate.course}° (${compass(candidate.course)}) · ${candidate.distanceNm} NM · llegada ~${formatHour(
                        candidate.arriveAt,
                      )} · ${formatDuration(candidate.totalHours)}`
                    : `Rumbo ${candidate.course}° (${compass(candidate.course)}) · ${candidate.distanceNm} NM · no completa el cruce con este viento`
                }
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
                <LegTable legs={candidate.legs} propulsion={isMotor ? 'motor' : 'vela'} />
              </div>
            </Card>
          )}
        </>
      )}

      {data && data.ranked.length === 0 && (
        <ErrorState message="No hay ventanas de salida diurnas en el horizonte del pronóstico." />
      )}
    </div>
  );
}
