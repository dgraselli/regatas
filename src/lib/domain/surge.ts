import type { HourlyPoint } from '@/lib/types/forecast';
import type { SurgeAlert, SurgeType } from '@/lib/types/water';
import type { SurgeThresholds } from '@/lib/types/config';
import { SURGE } from '@/lib/config/boat';
import { inSector } from '@/lib/domain/geo';

/**
 * Detección de marea meteorológica (sudestada / bajante). La calibración y los
 * números que la justifican están junto a los umbrales, en `SURGE`
 * (src/lib/config/boat.ts).
 *
 * Principal: el nivel del mar pronosticado (Open-Meteo Marine) filtrado a 25 h.
 * Respaldo, si no hay nivel: dirección y persistencia del viento del punto.
 */

interface Run {
  type: SurgeType;
  start: number; // índice inicial
  end: number; // índice final (inclusive)
}

/** Semiancho (h) de la media móvil: 25 h cubren dos ciclos de la marea semidiurna. */
const FILTER_HALF_H = 12;
/**
 * Muestras mínimas para que la media valga. En los bordes del pronóstico la
 * ventana queda de un solo lado; con 13 h todavía cubre un ciclo entero de la
 * marea (~12.4 h), así que la astronómica se sigue cancelando casi toda.
 */
const FILTER_MIN_SAMPLES = 13;
/** Horas de nivel mínimas para usar el método por nivel en vez del de viento. */
const MIN_SEA_LEVEL_HOURS = 24;
/** Conversión aproximada de la escala de Marine a la anomalía en el mareógrafo. */
const ANOMALY_SLOPE = 1.26;
const ANOMALY_OFFSET_M = -0.2;

/**
 * Media móvil centrada de 25 h del nivel del mar: saca la marea astronómica y
 * deja la meteorológica. `null` donde no hay muestras suficientes.
 */
export function tidalFilter(levels: (number | undefined | null)[]): (number | null)[] {
  return levels.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i - FILTER_HALF_H; j <= i + FILTER_HALF_H; j++) {
      const v = levels[j];
      if (v != null) {
        sum += v;
        n++;
      }
    }
    return n >= FILTER_MIN_SAMPLES ? sum / n : null;
  });
}

/** Anomalía estimada en el mareógrafo (m) para un nivel filtrado de Marine. */
export function levelToAnomalyM(filteredM: number): number {
  return ANOMALY_SLOPE * filteredM + ANOMALY_OFFSET_M;
}

function groupRuns(n: number, typeAt: (i: number) => SurgeType | null): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;
  for (let i = 0; i < n; i++) {
    const type = typeAt(i);
    if (current && type === current.type) {
      current.end = i;
    } else {
      if (current) runs.push(current);
      current = type ? { type, start: i, end: i } : null;
    }
  }
  if (current) runs.push(current);
  return runs;
}

const INTENSIDAD = { 1: 'leve', 2: 'marcada', 3: 'severa' } as const;

function windPhrase(avgWindKt: number): string {
  return avgWindKt >= 1 ? `viento medio ~${Math.round(avgWindKt)} kt` : 'poco viento';
}

function fromSeaLevel(hourly: HourlyPoint[], filtered: (number | null)[], t: SurgeThresholds): SurgeAlert[] {
  const runs = groupRuns(hourly.length, (i) => {
    const v = filtered[i];
    if (v == null) return null;
    if (v >= t.seaLevelHighM) return 'sudestada';
    if (v <= t.seaLevelLowM) return 'bajante';
    return null;
  });

  const alerts: SurgeAlert[] = [];
  for (const run of runs) {
    const durationH = run.end - run.start + 1;
    if (durationH < t.seaLevelMinHours) continue;
    const slice = hourly.slice(run.start, run.end + 1);
    const levels = filtered.slice(run.start, run.end + 1) as number[];
    const alta = run.type === 'sudestada';
    const peak = alta ? Math.max(...levels) : Math.min(...levels);
    const [sev2, sev3] = alta ? t.seaLevelHighSevM : t.seaLevelLowSevM;
    const beyond = (cut: number) => (alta ? peak >= cut : peak <= cut);
    const severity: 1 | 2 | 3 = beyond(sev3) ? 3 : beyond(sev2) ? 2 : 1;
    const anomalyM = Math.round(levelToAnomalyM(peak) * 10) / 10;
    const avgWindKt = slice.reduce((s, p) => s + p.windKt, 0) / durationH;
    const cuanto = `~${Math.abs(anomalyM).toFixed(1)} m ${alta ? 'sobre' : 'bajo'} lo normal`;

    alerts.push({
      type: run.type,
      startsAt: slice[0].time,
      endsAt: slice[slice.length - 1].time,
      durationH,
      severity,
      confidence: 0.85,
      avgWindKt: Math.round(avgWindKt),
      source: 'nivel',
      anomalyM,
      message: alta
        ? `Agua alta prevista (sudestada ${INTENSIDAD[severity]}): el río puede subir ${cuanto}. Puede dificultar la salida o inundar el club.`
        : `Agua baja prevista (bajante ${INTENSIDAD[severity]}): el río puede bajar ${cuanto}. Riesgo de varar al entrar o salir.`,
    });
  }
  return alerts;
}

function windSeverity(durationH: number, avgWindKt: number): 1 | 2 | 3 {
  const strong = avgWindKt >= 18;
  const long = durationH >= 12;
  if (strong && long) return 3;
  if (strong || long) return 2;
  return 1;
}

function fromWind(hourly: HourlyPoint[], t: SurgeThresholds): SurgeAlert[] {
  const runs = groupRuns(hourly.length, (i) => {
    const p = hourly[i];
    if (p.windKt < t.minWindKt) return null;
    if (inSector(p.windDir, t.sudestadaSector)) return 'sudestada';
    if (inSector(p.windDir, t.bajanteSector)) return 'bajante';
    return null;
  });

  const alerts: SurgeAlert[] = [];
  for (const run of runs) {
    const slice = hourly.slice(run.start, run.end + 1);
    const durationH = slice.length;
    if (durationH < t.minHours) continue;
    const avgWindKt = slice.reduce((s, p) => s + p.windKt, 0) / durationH;
    const severity = windSeverity(durationH, avgWindKt);
    const alta = run.type === 'sudestada';
    alerts.push({
      type: run.type,
      startsAt: slice[0].time,
      endsAt: slice[slice.length - 1].time,
      durationH,
      severity,
      // Sin nivel del mar la regla por viento es un respaldo flojo (ver SURGE).
      confidence: 0.5,
      avgWindKt: Math.round(avgWindKt),
      source: 'viento',
      message: alta
        ? `Posible sudestada ${INTENSIDAD[severity]}: viento del S/SE, ${windPhrase(avgWindKt)} durante ~${durationH} h. El agua puede subir y dificultar la salida o inundar el club.`
        : `Posible bajante ${INTENSIDAD[severity]}: viento del N/NW, ${windPhrase(avgWindKt)} durante ~${durationH} h. El agua puede bajar y dejar varada la embarcación.`,
    });
  }
  return alerts;
}

/**
 * Detecta eventos de marea meteorológica en el pronóstico horario. Si hay nivel
 * del mar (Marine) usa ese; si no, cae a la regla por viento.
 */
export function detectSurge(
  hourly: HourlyPoint[],
  thresholds: SurgeThresholds = SURGE,
): SurgeAlert[] {
  if (hourly.length === 0) return [];
  const levels = hourly.map((p) => p.seaLevelM);
  if (levels.filter((v) => v != null).length >= MIN_SEA_LEVEL_HOURS) {
    return fromSeaLevel(hourly, tidalFilter(levels), thresholds);
  }
  return fromWind(hourly, thresholds);
}
