'use client';

import { useForecast } from '@/lib/hooks/useForecast';
import { useWaterLevel } from '@/lib/hooks/useWaterLevel';
import { useProfile } from '@/lib/profile/ProfileContext';
import { AlertBanner, NoAlerts } from '@/components/alerts/AlertBanner';
import { WaterLevelGauge } from '@/components/alerts/WaterLevelGauge';
import { MetodologiaInfo } from '@/components/alerts/MetodologiaInfo';
import { LocationPicker } from '@/components/common/LocationPicker';
import { StaleForecastNotice } from '@/components/common/StaleForecastNotice';
import { Onboarding } from '@/components/common/Onboarding';
import { Card, CardHeader } from '@/components/ui/Card';
import { Loading, ErrorState } from '@/components/ui/States';

export default function AlertasPage() {
  const { profile, hydrated, activeLocation, setActiveLocation } = useProfile();
  const forecast = useForecast(activeLocation, profile.caution);
  const water = useWaterLevel(activeLocation);

  if (!hydrated) return <Loading />;
  if (!activeLocation) {
    return (
      <Onboarding
        title="Configurá tu lugar"
        body="Agregá tu amarra para ver alertas de sudestada y bajante en tu zona."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alertas de marea</h1>
          <p className="text-slate-500 text-sm">
            Sudestadas (sube el agua, riesgo de inundar el club) y bajantes (baja el agua,
            riesgo de varadura), estimadas según viento y nivel observado.
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

      <section className="space-y-2">
        <h2 className="font-semibold text-slate-700">Eventos previstos</h2>
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
        {forecast.data &&
          (forecast.data.surge.length > 0 ? (
            forecast.data.surge.map((a, i) => <AlertBanner key={i} alert={a} />)
          ) : (
            <NoAlerts />
          ))}
      </section>

      <MetodologiaInfo stationName={water.data?.stationName} />
    </div>
  );
}
