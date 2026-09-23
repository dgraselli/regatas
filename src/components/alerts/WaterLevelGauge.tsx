'use client';

import type { WaterLevelStatus } from '@/lib/types/water';
import { useObservationAge } from '@/lib/hooks/useFreshness';
import { tideRate } from '@/lib/domain/tideWindow';

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
export function WaterLevelGauge({ status }: { status: WaterLevelStatus }) {
  const obs = status.observations;
  const last = obs[obs.length - 1];
  // Hace cuánto MIDIÓ el mareógrafo, no hace cuánto lo bajamos nosotros.
  const age = useObservationAge(last?.time);
  if (obs.length === 0) return null;
  const t = TREND[status.trend];
  // Sentido y fuerza de la corriente de marea, derivados del nivel MEDIDO.
  const rate = tideRate(obs);

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
                  Marea <strong>{rate.stream}</strong> · {Math.abs(rate.cmPerH).toFixed(0)} cm/h
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end text-xs">
          <span className="text-slate-400">{status.stationName}</span>
          <span className={age?.stale ? 'font-medium text-amber-700' : 'text-slate-400'}>
            {age?.stale && '⚠️ '}Observado {age?.agoLabel ?? ''}
          </span>
        </div>
      </div>

      {age?.severe && (
        <p className="mt-2 text-sm text-amber-700">
          ⚠️ La estación no reporta {age.agoLabel.replace('hace', 'desde hace')}: probablemente
          esté caída. Tomá el nivel como referencia vieja.
        </p>
      )}
    </div>
  );
}
