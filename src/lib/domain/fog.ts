import type { HourlyPoint, FogAlert } from '@/lib/types/forecast';
import type { ScoringThresholds } from '@/lib/types/config';
import { SCORING } from '@/lib/config/boat';

interface Run {
  start: number; // índice inicial
  end: number; // índice final (inclusive)
}

/** Visibilidad legible: metros por debajo de 1 km, km por encima. */
function formatVis(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function messageFor(severity: 1 | 2, minVisM: number): string {
  if (severity === 2) {
    return `Posible niebla: visibilidad mínima ~${formatVis(
      minVisM,
    )}. Puede impedir ver boyas y tráfico; conviene demorar la salida hasta que levante.`;
  }
  return `Visibilidad reducida (neblina): mínima ~${formatVis(
    minVisM,
  )}. Precaución al navegar, sobre todo a primera hora.`;
}

/**
 * Detecta ventanas de niebla / visibilidad reducida agrupando horas consecutivas
 * con visibilidad por debajo del umbral (que depende de la tolerancia elegida).
 * El pronóstico de niebla es poco confiable, por eso la confianza es baja: se
 * comunica siempre como "posible".
 */
export function detectFog(
  hourly: HourlyPoint[],
  thresholds: ScoringThresholds = SCORING,
): FogAlert[] {
  if (hourly.length === 0) return [];

  // Agrupar horas consecutivas con visibilidad baja (ignorando las sin dato).
  const runs: Run[] = [];
  let current: Run | null = null;
  hourly.forEach((p, idx) => {
    const low = p.visibilityM != null && p.visibilityM <= thresholds.fogYellowM;
    if (current && low) {
      current.end = idx;
    } else {
      if (current) runs.push(current);
      current = low ? { start: idx, end: idx } : null;
    }
  });
  if (current) runs.push(current);

  const alerts: FogAlert[] = [];
  for (const run of runs) {
    const slice = hourly.slice(run.start, run.end + 1);
    const vis = slice.map((p) => p.visibilityM).filter((v): v is number => v != null);
    const minVisibilityM = Math.round(Math.min(...vis));
    const severity: 1 | 2 = minVisibilityM <= thresholds.fogRedM ? 2 : 1;
    // Persistente => un poco más de confianza, pero siempre baja.
    const confidence = slice.length >= 3 ? 0.5 : 0.35;

    alerts.push({
      startsAt: slice[0].time,
      endsAt: slice[slice.length - 1].time,
      durationH: slice.length,
      severity,
      minVisibilityM,
      confidence,
      message: messageFor(severity, minVisibilityM),
    });
  }

  return alerts;
}
