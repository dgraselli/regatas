'use client';

import { useState, useMemo } from 'react';
import { useForecast } from '@/lib/hooks/useForecast';
import { DEFAULT_CLUB_ID } from '@/lib/config/clubs';
import { ForecastStrip } from '@/components/dashboard/ForecastStrip';
import { HourlyWindChart } from '@/components/dashboard/HourlyWindChart';
import { TrafficLight } from '@/components/dashboard/TrafficLight';
import { AlertBanner } from '@/components/alerts/AlertBanner';
import { LocationPicker } from '@/components/common/LocationPicker';
import { OfflineBadge } from '@/components/common/OfflineBadge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Loading, ErrorState } from '@/components/ui/States';
import { formatDate } from '@/lib/format';

export default function DashboardPage() {
  const [clubId, setClubId] = useState(DEFAULT_CLUB_ID);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useForecast(clubId);

  const days = data?.bundle.days ?? [];
  const activeDate = selectedDate ?? days[0]?.date ?? '';
  const selectedDay = days.find((d) => d.date === activeDate);

  const hoursOfDay = useMemo(
    () => (data?.bundle.hourly ?? []).filter((p) => p.time.slice(0, 10) === activeDate),
    [data, activeDate],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">¿Salimos a navegar?</h1>
          <p className="text-slate-500 text-sm">
            Pronóstico de los próximos días con semáforo de navegabilidad.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LocationPicker value={clubId} onChange={setClubId} />
          <OfflineBadge fetchedAt={data?.bundle.fetchedAt} />
        </div>
      </div>

      {isLoading && <Loading label="Obteniendo pronóstico…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}

      {data && (
        <>
          {data.surge.length > 0 && (
            <div className="space-y-2">
              {data.surge.map((a, i) => (
                <AlertBanner key={i} alert={a} />
              ))}
            </div>
          )}

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
                      <span className="text-slate-300">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
                <HourlyWindChart points={hoursOfDay} />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
