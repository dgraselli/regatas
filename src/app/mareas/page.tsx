'use client';

import { useForecast } from '@/lib/hooks/useForecast';
import { useWaterLevel } from '@/lib/hooks/useWaterLevel';
import { useProfile } from '@/lib/profile/ProfileContext';
import { AlertBanner, NoAlerts } from '@/components/alerts/AlertBanner';
import { WaterLevelGauge } from '@/components/alerts/WaterLevelGauge';
import { TideWindowChart } from '@/components/alerts/TideWindowChart';
import { MetodologiaInfo } from '@/components/alerts/MetodologiaInfo';
import { LocationPicker } from '@/components/common/LocationPicker';
import { StaleForecastNotice } from '@/components/common/StaleForecastNotice';
import { Onboarding } from '@/components/common/Onboarding';
import { Card, CardHeader } from '@/components/ui/Card';
import { Loading, ErrorState } from '@/components/ui/States';
import { useNowInTz } from '@/lib/hooks/useNow';
import { buildTideWindow } from '@/lib/domain/tideWindow';
import { TIMEZONE } from '@/lib/profile/defaults';
import { formatHour } from '@/lib/format';

export default function MareasPage() {
  const { profile, hydrated, activeLocation, setActiveLocation } = useProfile();
  const forecast = useForecast(activeLocation, profile.caution, profile.lowWindKt);
  const water = useWaterLevel(activeLocation);
  const now = useNowInTz(activeLocation?.timezone ?? TIMEZONE);
  const win = buildTideWindow(
    water.data?.observations ?? [],
    forecast.data?.bundle.hourly ?? [],
    now,
    { safeMinM: activeLocation?.safeLevelMinM, safeMaxM: activeLocation?.safeLevelMaxM },
  );

  if (!hydrated) return <Loading />;
  if (!activeLocation) {
    return (
      <Onboarding
        title="Configurá tu lugar"
        body="Agregá tu amarra para ver el nivel del agua y las alertas de sudestada y bajante en tu zona."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mareas</h1>
          <p className="text-slate-500 text-sm">
            Nivel del agua observado y marea meteorológica (sudestadas y bajantes) en tu zona.
            Las alertas de niebla están en el panel.
          </p>
        </div>
        <LocationPicker
          locations={profile.locations}
          value={activeLocation.id}
          onChange={setActiveLocation}
        />
      </div>

      <Card>
        <CardHeader
          title="Nivel de agua observado"
          subtitle="Fuente: INA — Sistema de Alerta Hidrológico (estación más cercana)"
        />
        <div className="px-4 pb-4 pt-3">
          {water.isLoading && <Loading />}
          {water.isError && <ErrorState />}
          {water.data &&
            (water.data.observations.length > 0 ? (
              <WaterLevelGauge status={water.data} />
            ) : (
              <p className="text-sm text-slate-500">
                Sin datos recientes de la estación más cercana.
              </p>
            ))}
        </div>
      </Card>

      {win.points.length > 1 && (
        <Card>
          <CardHeader
            title="Próximas horas"
            subtitle="Nivel estimado hasta 12 h, anclado a la última medición del mareógrafo"
          />
          <div className="px-4 pb-4 pt-3">
            {win.unsafe.length > 0 ? (
              <ul className="mb-3 space-y-1 text-sm">
                {win.unsafe.map((s, i) => (
                  <li key={i} className={s.kind === 'bajo' ? 'text-mar-700' : 'text-orange-800'}>
                    ⚠️ <strong>{s.kind === 'bajo' ? 'Poca agua' : 'Agua alta'}</strong> desde las{' '}
                    {formatHour(s.startsAt)}{' '}
                    {s.endsAt ? `hasta las ${formatHour(s.endsAt)}` : 'y sigue así'}
                  </li>
                ))}
              </ul>
            ) : (
              activeLocation.safeLevelMinM != null || activeLocation.safeLevelMaxM != null ? (
                <p className="mb-3 text-sm text-emerald-700">
                  ✓ El nivel se mantiene dentro de tu rango seguro las próximas 12 h.
                </p>
              ) : (
                <p className="mb-3 text-sm text-slate-500">
                  Definí los niveles seguros de tu amarra en Perfil para que te avise hasta qué hora
                  podés salir.
                </p>
              )
            )}
            <TideWindowChart
              win={win}
              now={now}
              safeMinM={activeLocation.safeLevelMinM}
              safeMaxM={activeLocation.safeLevelMaxM}
            />
          </div>
        </Card>
      )}

      {forecast.isLoading && <Loading />}
      {forecast.isError && !forecast.data && (
        <ErrorState message={(forecast.error as Error)?.message} />
      )}
      {forecast.data && (
        <StaleForecastNotice
          fetchedAt={forecast.data.bundle.fetchedAt}
          isError={forecast.isError}
          isFetching={forecast.isFetching}
        />
      )}

      {forecast.data && (
        <section className="space-y-2">
          <h2 className="font-semibold text-slate-700">Marea meteorológica</h2>
          {forecast.data.surge.length > 0 ? (
            forecast.data.surge.map((a, i) => <AlertBanner key={i} alert={a} />)
          ) : (
            <NoAlerts />
          )}
        </section>
      )}

      <MetodologiaInfo stationName={water.data?.stationName} />
    </div>
  );
}
