import type { HourlyPoint } from '@/lib/types/forecast';
import type { SurgeAlert, SurgeType } from '@/lib/types/water';
import type { SurgeThresholds } from '@/lib/types/config';
import { SURGE } from '@/lib/config/boat';
import { inSector } from '@/lib/domain/geo';

interface Run {
  type: SurgeType;
  start: number; // índice inicial
  end: number; // índice final (inclusive)
}

function classify(point: HourlyPoint, t: SurgeThresholds): SurgeType | null {
  if (point.windKt < t.minWindKt) return null;
  if (inSector(point.windDir, t.sudestadaSector)) return 'sudestada';
  if (inSector(point.windDir, t.bajanteSector)) return 'bajante';
  return null;
}

function severityFor(durationH: number, avgWindKt: number): 1 | 2 | 3 {
  const strong = avgWindKt >= 28;
  const long = durationH >= 12;
  if (strong && long) return 3;
  if (strong || long || durationH >= 9) return 2;
  return 1;
}

function messageFor(type: SurgeType, sev: number, dur: number, wind: number): string {
  const intensidad = sev === 3 ? 'severa' : sev === 2 ? 'marcada' : 'leve';
  if (type === 'sudestada') {
    return `Posible sudestada ${intensidad}: viento del SE ~${Math.round(
      wind,
    )} kt durante ~${dur} h. El agua puede subir y dificultar la salida o inundar el club.`;
  }
  return `Posible bajante ${intensidad}: viento del N/NW ~${Math.round(
    wind,
  )} kt durante ~${dur} h. El agua puede bajar y dejar varada la embarcación.`;
}

/**
 * Detecta eventos de marea meteorológica (sudestada / bajante) a partir de la
 * dirección y persistencia del viento. Si hay nivel del mar (Marine API) que
 * confirme la tendencia, sube la confianza.
 */
export function detectSurge(
  hourly: HourlyPoint[],
  thresholds: SurgeThresholds = SURGE,
): SurgeAlert[] {
  if (hourly.length === 0) return [];

  // Agrupar horas consecutivas del mismo tipo.
  const runs: Run[] = [];
  let current: Run | null = null;
  hourly.forEach((p, idx) => {
    const type = classify(p, thresholds);
    if (current && type === current.type) {
      current.end = idx;
    } else {
      if (current) runs.push(current);
      current = type ? { type, start: idx, end: idx } : null;
    }
  });
  if (current) runs.push(current);

  const alerts: SurgeAlert[] = [];
  for (const run of runs) {
    const slice = hourly.slice(run.start, run.end + 1);
    const durationH = slice.length;
    if (durationH < thresholds.minHours) continue;

    const avgWindKt = slice.reduce((s, p) => s + p.windKt, 0) / durationH;
    const severity = severityFor(durationH, avgWindKt);

    // Corroboración con nivel del mar, si está disponible.
    let confidence = 0.6;
    const levels = slice.map((p) => p.seaLevelM).filter((v): v is number => v != null);
    if (levels.length >= 2) {
      const delta = levels[levels.length - 1] - levels[0];
      const expectedRise = run.type === 'sudestada';
      if ((expectedRise && delta > 0.05) || (!expectedRise && delta < -0.05)) {
        confidence = 0.85;
      } else if (Math.abs(delta) < 0.03) {
        confidence = 0.55;
      } else {
        confidence = 0.4; // el nivel contradice la heurística
      }
    }

    alerts.push({
      type: run.type,
      startsAt: slice[0].time,
      endsAt: slice[slice.length - 1].time,
      durationH,
      severity,
      confidence,
      avgWindKt: Math.round(avgWindKt),
      message: messageFor(run.type, severity, durationH, avgWindKt),
    });
  }

  return alerts;
}
