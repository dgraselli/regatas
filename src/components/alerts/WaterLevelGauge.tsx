'use client';

import type { WaterLevelStatus } from '@/lib/types/water';
import { useObservationAge } from '@/lib/hooks/useFreshness';
import { tideRate, type TidePoint } from '@/lib/domain/tideWindow';
import { formatHour } from '@/lib/format';

/** Páginas públicas de cada fuente, para poder chequear el dato en el origen. */
export const WATER_SOURCES = {
  SHN: {
    label: 'SHN — alturas horarias',
    url: 'https://www.hidro.gov.ar/oceanografia/AlturasHorarias.asp',
  },
  INA: { label: 'INA — Sistema de Alerta', url: 'https://alerta.ina.gob.ar/' },
} as const;

/** El servicio etiqueta la estación con la fuente usada: "Nombre (SHN)" / "Nombre (INA)". */
function sourceOf(stationName: string) {
  const m = stationName.match(/\((SHN|INA)\)\s*$/);
  return m ? WATER_SOURCES[m[1] as keyof typeof WATER_SOURCES] : null;
}

const TREND: Record<WaterLevelStatus['trend'], { label: string; arrow: string; color: string }> = {
  subiendo: { label: 'Subiendo', arrow: '↑', color: 'text-orange-600' },
  bajando: { label: 'Bajando', arrow: '↓', color: 'text-mar-600' },
  estable: { label: 'Estable', arrow: '→', color: 'text-slate-500' },
};

/**
 * Lectura del nivel actual: el número grande, la tendencia y de qué estación
 * sale, con la antigüedad del dato medido.
 *
 * La curva no vive acá: nivel observado y pronóstico son el mismo dato y se
 * dibujan juntos en `TideWindowChart`, porque en dos gráficos separados había
 * que reconstruir a ojo la continuidad entre lo medido y lo estimado.
 */
export function WaterLevelGauge({ status, estimate }: { status: WaterLevelStatus; estimate?: TidePoint }) {
  const obs = status.observations;
  const last = obs[obs.length - 1];
  // Hace cuánto MIDIÓ el mareógrafo, no hace cuánto lo bajamos nosotros.
  const age = useObservationAge(last?.time);
  if (obs.length === 0) return null;
  const t = TREND[status.trend];
  // Sentido y fuerza de la corriente de marea, derivados del nivel MEDIDO.
  const rate = tideRate(obs);
  const source = sourceOf(status.stationName);

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-3xl font-semibold text-slate-800">{last.heightM.toFixed(2)} m</span>
          <span className={`ml-2 font-medium ${t.color}`}>
            {t.arrow} {t.label}
          </span>
          {rate && (
            <p className="mt-1 text-sm text-slate-500">
              {rate.stream === 'parada' ? (
                <>Marea casi parada — poca corriente.</>
              ) : (
                <>
                  {/* Es la velocidad a la que cambia el NIVEL, no la de la
                      corriente: el sentido de la corriente se infiere del signo. */}
                  Nivel {rate.cmPerH > 0 ? 'subiendo' : 'bajando'}{' '}
                  {Math.abs(rate.cmPerH).toFixed(0)} cm/h · marea <strong>{rate.stream}</strong>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end text-xs">
          <span className="text-slate-400">{status.stationName}</span>
          <span className={age?.stale ? 'font-medium text-amber-700' : 'text-slate-400'}>
            {age?.stale && '⚠️ '}Medido a las {formatHour(last.time)} ({age?.agoLabel ?? ''})
          </span>
          {source && (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-mar-600 underline hover:text-mar-700"
            >
              Fuente: {source.label} ↗
            </a>
          )}
        </div>
      </div>

      {/* Lo mismo que muestra el panel como número grande: la estimación para la
          hora en curso. Se muestra aparte del medido para que no parezcan dos
          datos contradictorios. */}
      {estimate && estimate.source !== 'medido' && (
        <p className="mt-1 text-sm text-slate-500">
          Estimado para las {formatHour(estimate.time)}:{' '}
          <strong className="text-slate-700">{estimate.heightM.toFixed(2)} m</strong> ±{' '}
          {estimate.uncertaintyM.toFixed(2)}
        </p>
      )}

      {age?.severe && (
        <p className="mt-2 text-sm text-amber-700">
          ⚠️ La estación no reporta {age.agoLabel.replace('hace', 'desde hace')}: probablemente
          esté caída. Tomá el nivel como referencia vieja.
        </p>
      )}
    </div>
  );
}
