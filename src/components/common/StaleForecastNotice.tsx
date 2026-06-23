'use client';

import { useFreshness } from '@/lib/hooks/useFreshness';

/**
 * Aviso prominente cuando los datos mostrados pueden estar desactualizados:
 * o bien la última actualización falló (`isError`), o bien el pronóstico
 * guardado ya tiene su tiempo. Pensado para que NO pase desapercibido: si la
 * app sirve un pronóstico viejo (PWA offline, caída de la fuente, etc.), el
 * usuario tiene que enterarse antes de decidir salir a navegar.
 */
export function StaleForecastNotice({
  fetchedAt,
  isError,
  isFetching,
}: {
  fetchedAt?: string;
  isError?: boolean;
  isFetching?: boolean;
}) {
  const f = useFreshness(fetchedAt);
  if (!f) return null;

  // Avisar si falló la actualización o si el dato ya está viejo. Si justo está
  // reintentando, no alarmamos (puede resolverse en un segundo).
  const show = (isError || f.stale) && !isFetching;
  if (!show) return null;

  const severe = isError || f.severe;
  const cls = severe
    ? 'bg-red-100 border-red-300 text-red-900'
    : 'bg-amber-100 border-amber-300 text-amber-900';

  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>
      <p className="font-semibold flex items-center gap-2">
        <span aria-hidden>⚠️</span>
        {isError ? 'No se pudieron actualizar los datos' : 'Pronóstico posiblemente desactualizado'}
      </p>
      <p className="mt-1">
        {isError
          ? `Estás viendo el último pronóstico guardado, del ${f.absLabel} (${f.agoLabel}). `
          : `Este pronóstico es del ${f.absLabel} (${f.agoLabel}) y puede no reflejar las condiciones actuales. `}
        Verificá tu conexión y el pronóstico oficial antes de salir.
      </p>
    </div>
  );
}
