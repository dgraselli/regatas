'use client';

import { useState } from 'react';
import { useForecast } from '@/lib/hooks/useForecast';
import { useWaterLevel } from '@/lib/hooks/useWaterLevel';
import { DEFAULT_CLUB_ID } from '@/lib/config/clubs';
import { AlertBanner, NoAlerts } from '@/components/alerts/AlertBanner';
import { WaterLevelGauge } from '@/components/alerts/WaterLevelGauge';
import { LocationPicker } from '@/components/common/LocationPicker';
import { Card, CardHeader } from '@/components/ui/Card';
import { Loading, ErrorState } from '@/components/ui/States';

export default function AlertasPage() {
  const [clubId, setClubId] = useState(DEFAULT_CLUB_ID);
  const forecast = useForecast(clubId);
  const water = useWaterLevel();

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
        <LocationPicker value={clubId} onChange={setClubId} />
      </div>

      <Card>
        <CardHeader title="Nivel de agua observado" subtitle="Fuente: INA (ejemplo)" />
        <div className="px-4 pb-4 pt-3">
          {water.isLoading && <Loading />}
          {water.isError && <ErrorState />}
          {water.data && <WaterLevelGauge status={water.data} />}
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="font-semibold text-slate-700">Eventos previstos</h2>
        {forecast.isLoading && <Loading />}
        {forecast.isError && <ErrorState message={(forecast.error as Error)?.message} />}
        {forecast.data &&
          (forecast.data.surge.length > 0 ? (
            forecast.data.surge.map((a, i) => <AlertBanner key={i} alert={a} />)
          ) : (
            <NoAlerts />
          ))}
      </section>

      <p className="text-xs text-slate-400">
        El pronóstico oficial de altura de agua y sudestadas lo emite el{' '}
        <a
          className="underline"
          href="https://www.hidro.gob.ar"
          target="_blank"
          rel="noreferrer"
        >
          Servicio de Hidrografía Naval (SHN)
        </a>
        . Estas alertas son orientativas.
      </p>
    </div>
  );
}
