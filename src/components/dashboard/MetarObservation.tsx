'use client';

import type { MetarStatus } from '@/lib/services/metar';
import { metarVisibilityLevel, type VisibilityLevel } from '@/lib/domain/metar';
import { scoringFor } from '@/lib/config/boat';
import type { Caution } from '@/lib/profile/types';
import { Card } from '@/components/ui/Card';

const LEVEL: Record<
  Exclude<VisibilityLevel, 'sin-dato'>,
  { label: string; cls: string; border: string }
> = {
  despejado: { label: 'Buena visibilidad', cls: 'bg-emerald-50 text-emerald-700', border: '' },
  neblina: {
    label: 'Visibilidad reducida',
    cls: 'bg-amber-50 text-amber-700',
    border: 'border-amber-300',
  },
  niebla: { label: 'Niebla', cls: 'bg-red-50 text-red-700', border: 'border-2 border-red-400' },
};

function fmtVis(m?: number): string {
  if (m == null) return '—';
  if (m >= 9000) return '≥ 10 km';
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m} m`;
}

function ageLabel(iso?: string): string {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 0) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
}

/** Edad máxima para mostrar la observación: más vieja solo puede venir de un
 * caché restaurado sin red (la API se pide con ventana de 2 h), y un dato de
 * "ahora" con horas de edad es peor que nada. */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * Tarjeta con la visibilidad OBSERVADA (METAR) del aeropuerto más cercano. Es un
 * dato medido "de ahora" que complementa el flojo pronóstico de niebla. No entra al
 * semáforo (es observación, no pronóstico a 7 días): informa el hoy.
 */
export function MetarObservation({
  status,
  caution = 'normal',
}: {
  status: MetarStatus;
  caution?: Caution;
}) {
  const { observation: o, distanceKm } = status;
  if (o.time && Date.now() - new Date(o.time).getTime() > MAX_AGE_MS) return null;
  const level = metarVisibilityLevel(o, scoringFor(caution));
  if (level === 'sin-dato') return null;
  const meta = LEVEL[level];
  const humid = o.spreadC != null && o.spreadC <= 2; // aire casi saturado = propenso a niebla

  return (
    <Card className={`p-4 ${meta.border}`}>
      <div className="text-xs font-medium text-slate-500">🛬 Visibilidad observada ahora</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl font-semibold text-slate-800">{fmtVis(o.visibilityM)}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
        <span className="text-xs text-slate-400">{ageLabel(o.time)}</span>
      </div>
      {o.spreadC != null && (
        <div className="mt-1 text-xs text-slate-400">
          Temp/rocío con {o.spreadC.toFixed(0)}° de diferencia
          {humid ? ' — aire húmedo, propenso a niebla' : ''}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Medido en {o.name ?? o.station} (aeropuerto a ~{distanceKm} km), no sobre el agua. Fuente:
        METAR — observación, no pronóstico.
      </p>
    </Card>
  );
}
