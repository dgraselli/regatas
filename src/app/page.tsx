'use client';

import { useState, useMemo } from 'react';
import { useForecast } from '@/lib/hooks/useForecast';
import { useWaterLevel } from '@/lib/hooks/useWaterLevel';
import { useMetarObservation } from '@/lib/hooks/useMetarObservation';
import { Onboarding } from '@/components/common/Onboarding';
import { useProfile } from '@/lib/profile/ProfileContext';
import { ForecastStrip } from '@/components/dashboard/ForecastStrip';
import { HourlyWindChart } from '@/components/dashboard/HourlyWindChart';
import { HourlyWaveChart } from '@/components/dashboard/HourlyWaveChart';
import { TrafficLight } from '@/components/dashboard/TrafficLight';
import { TideSummary } from '@/components/dashboard/TideSummary';
import { MetarObservation } from '@/components/dashboard/MetarObservation';
import { MetodologiaPanel } from '@/components/dashboard/MetodologiaPanel';
import { FogAlertList } from '@/components/alerts/AlertBanner';
import { LocationPicker } from '@/components/common/LocationPicker';
import { LocateButton } from '@/components/common/LocateButton';
import { BoatPicker } from '@/components/common/BoatPicker';
import { CautionPicker } from '@/components/common/CautionPicker';
import { OfflineBadge } from '@/components/common/OfflineBadge';
import { StaleForecastNotice } from '@/components/common/StaleForecastNotice';
import { Card, CardHeader } from '@/components/ui/Card';
import { Loading, ErrorState } from '@/components/ui/States';
import { formatDate, todayInTz } from '@/lib/format';
import { TIMEZONE } from '@/lib/profile/defaults';
import { reasonIcon } from '@/lib/reasonIcon';
import { track } from '@/lib/analytics';

export default function DashboardPage() {
  const { profile, hydrated, activeLocation, activeBoat, setActiveLocation, setActiveBoat, setCaution } =
    useProfile();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const water = useWaterLevel(activeLocation);
  const metar = useMetarObservation(activeLocation);
  const { data, isLoading, isError, isFetching, error } = useForecast(
    activeLocation,
    profile.caution,
    profile.lowWindKt,
    activeBoat?.propulsion ?? 'vela',
  );

  // Descartar días ya pasados: el caché persistido puede servir un pronóstico
  // viejo (de un día anterior) mientras revalida. Solo desde el día en curso.
  const today = todayInTz(activeLocation?.timezone ?? TIMEZONE);
  const days = (data?.bundle.days ?? []).filter((d) => d.date >= today);
  // Si la selección guardada apunta a un día ya pasado, caer al primer día vigente.
  const selectedIsValid = selectedDate != null && days.some((d) => d.date === selectedDate);
  const activeDate = (selectedIsValid ? selectedDate : days[0]?.date) ?? '';
  const selectedDay = days.find((d) => d.date === activeDate);

  const hoursOfDay = useMemo(
    () => (data?.bundle.hourly ?? []).filter((p) => p.time.slice(0, 10) === activeDate),
    [data, activeDate],
  );

  if (!hydrated) return <Loading />;

  if (!activeLocation) {
    return (
      <Onboarding
        title="Configurá tu lugar"
        body="Agregá tu amarra o el lugar desde donde navegás para ver el pronóstico y el semáforo de navegabilidad."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">¿Salimos a navegar?</h1>
          <p className="text-slate-500 text-sm">
            Pronóstico de los próximos días con semáforo de navegabilidad
            {activeBoat ? ` para el ${activeBoat.name}` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <LocationPicker
            locations={profile.locations}
            value={activeLocation.id}
            onChange={setActiveLocation}
          />
          <LocateButton />
          {profile.boats.length > 1 && (
            <BoatPicker
              boats={profile.boats}
              value={activeBoat?.id ?? null}
              onChange={setActiveBoat}
            />
          )}
          <CautionPicker
            value={profile.caution}
            onChange={(c) => {
              setCaution(c);
              track('change_caution', { caution: c });
            }}
          />
          <OfflineBadge fetchedAt={data?.bundle.fetchedAt} />
        </div>
      </div>

      {isLoading && <Loading label="Obteniendo pronóstico…" />}
      {/* Error duro solo si no hay ningún dato cacheado para mostrar. Si hay
          datos viejos, el aviso prominente va dentro del bloque de abajo. */}
      {isError && !data && <ErrorState message={(error as Error)?.message} />}

      {data && (
        <>
          <StaleForecastNotice
            fetchedAt={data.bundle.fetchedAt}
            isError={isError}
            isFetching={isFetching}
          />

          <TideSummary
            status={water.data}
            surge={data.surge}
            safeMinM={activeLocation.safeLevelMinM}
            safeMaxM={activeLocation.safeLevelMaxM}
          />

          {data.fog.length > 0 && <FogAlertList alerts={data.fog} />}

          {metar.data && <MetarObservation status={metar.data} caution={profile.caution} />}

          <ForecastStrip days={days} selectedDate={activeDate} onSelect={setSelectedDate} />

          {selectedDay && (
            <Card>
              <CardHeader
                title={formatDate(selectedDay.date)}
                subtitle={`Viento ~${selectedDay.metrics.windMedianKt} kt · ráfagas hasta ${selectedDay.metrics.gustPeakKt} kt`}
                right={<TrafficLight level={selectedDay.level} />}
              />
              <div className="px-4 pb-4 pt-3">
                <ul className="mb-4 space-y-1">
                  {selectedDay.reasons.map((r, i) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2">
                      <span aria-hidden className="w-4 shrink-0 text-center">
                        {reasonIcon(r)}
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
                <HourlyWindChart
                  points={hoursOfDay}
                  caution={profile.caution}
                  lowWindKt={profile.lowWindKt}
                  location={{ lat: activeLocation.lat, lon: activeLocation.lon }}
                />
                {hoursOfDay.some((p) => p.waveHeightM != null) && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="mb-1 text-xs font-medium text-slate-500">🌊 Oleaje</p>
                    <HourlyWaveChart
                      points={hoursOfDay}
                      caution={profile.caution}
                      location={{ lat: activeLocation.lat, lon: activeLocation.lon }}
                    />
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      <MetodologiaPanel caution={profile.caution} propulsion={activeBoat?.propulsion ?? 'vela'} />
    </div>
  );
}
