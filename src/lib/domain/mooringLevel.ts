import type { SurgeAlert, WaterLevelObservation } from '@/lib/types/water';
import { MOORING } from '@/lib/config/boat';
import { tidalFilter } from '@/lib/domain/surge';
import { hourKey, shiftHours } from '@/lib/domain/tideWindow';

/**
 * Nivel del agua estimado EN LA AMARRA para los próximos días (escala del
 * mareógrafo) y aviso cuando sale del rango seguro del usuario.
 *
 * Las alertas de sudestada/bajante (`surge.ts`) miran cuánto se aparta el río de
 * lo normal, con umbrales iguales para todos. Esto, en cambio, responde "¿mi
 * amarra va a tener poca o demasiada agua?": marea + marea meteorológica, en
 * metros del mareógrafo, contra los niveles que cargó cada uno.
 *
 * Pasos (calibración y números en `MOORING`, src/lib/config/boat.ts):
 *  1. Se separa el nivel de Open-Meteo Marine en marea astronómica (nivel − media
 *     de 25 h) y meteorológica (la media).
 *  2. Se corrige: la marea se agranda (`tideAmp`) y la bajante, por debajo de
 *     `lowKneeM`, se amplifica (`lowGain`), porque el modelo la marca a medias.
 *  3. Se corre `lagH` horas: el modelo adelanta la marea.
 *  4. Se ancla al cero del mareógrafo con la diferencia media contra las últimas
 *     `calibHours` horas medidas.
 */

export interface LevelSample {
  /** Hora en punto local, 'YYYY-MM-DDTHH:00'. */
  time: string;
  /** Altura (m). */
  m: number;
}

export interface MooringProjection {
  /** Nivel estimado por hora, en la escala del mareógrafo. */
  points: LevelSample[];
  /** Diferencia (m) entre el cero del mareógrafo y el modelo corregido. */
  offsetM: number;
  /** Horas medidas con que se ancló. */
  calibHours: number;
}

/** Nivel del modelo corregido (paso 1-3), indexado por la hora a la que corresponde. */
export function correctedModel(series: LevelSample[]): Map<string, number> {
  const sorted = [...series].sort((a, b) => a.time.localeCompare(b.time));
  const filtered = tidalFilter(sorted.map((s) => s.m));
  const out = new Map<string, number>();
  // El corrimiento empuja las últimas horas más allá del pronóstico: se recortan.
  const lastKey = sorted.length ? hourKey(sorted[sorted.length - 1].time) : null;
  sorted.forEach((s, i) => {
    const f = filtered[i];
    const key = hourKey(s.time);
    if (f == null || key == null) return;
    if (lastKey && shiftHours(key, MOORING.lagH) > lastKey) return;
    const meteo = f >= MOORING.lowKneeM ? f : MOORING.lowKneeM + MOORING.lowGain * (f - MOORING.lowKneeM);
    out.set(shiftHours(key, MOORING.lagH), MOORING.tideAmp * (s.m - f) + meteo);
  });
  return out;
}

/**
 * Proyección del nivel en la amarra. null si no hay suficientes horas medidas
 * que coincidan con el modelo para anclarlo (sin ancla, el número no significa
 * nada en la escala del usuario).
 */
export function projectMooringLevel(
  series: LevelSample[],
  observations: WaterLevelObservation[],
): MooringProjection | null {
  const model = correctedModel(series);
  if (model.size === 0) return null;

  const obsByHour = new Map<string, number>();
  for (const o of observations) {
    const k = hourKey(o.time);
    if (k) obsByHour.set(k, o.heightM);
  }
  const hours = [...obsByHour.keys()].sort().slice(-MOORING.calibHours);
  const diffs = hours.filter((k) => model.has(k)).map((k) => obsByHour.get(k)! - model.get(k)!);
  if (diffs.length < MOORING.minCalibHours) return null;
  const offsetM = diffs.reduce((a, b) => a + b, 0) / diffs.length;

  const points = [...model.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, m]) => ({ time, m: m + offsetM }));
  return { points, offsetM, calibHours: diffs.length };
}

const fmtM = (m: number) => `${m.toFixed(2)} m`;
const hourLabel = (time: string) => `${Number(time.slice(11, 13))} h`;

/**
 * Avisos de la amarra: uno por día y por tipo (poca agua / agua alta) con las
 * horas en que el nivel estimado queda fuera del rango seguro, o a menos de
 * `marginM` del límite. Sólo de `fromTime` en adelante.
 *
 * Se devuelven con la forma de `SurgeAlert` (source 'amarra', severidad 2:
 * precaución) para que el semáforo, el panel y Mareas los traten igual que las
 * alertas regionales. No llegan a rojo: ~1 de cada 3 avisos no se cumple.
 */
export function mooringAlerts(
  projection: MooringProjection,
  range: { safeMinM?: number; safeMaxM?: number },
  fromTime: string,
): SurgeAlert[] {
  const { safeMinM, safeMaxM } = range;
  if (safeMinM == null && safeMaxM == null) return [];
  const from = hourKey(fromTime) ?? fromTime;
  const ahead = projection.points.filter((p) => p.time >= from);

  type Kind = 'bajo' | 'alto';
  const groups = new Map<string, { kind: Kind; date: string; hours: LevelSample[] }>();
  for (const p of ahead) {
    const kind: Kind | null =
      safeMinM != null && p.m < safeMinM + MOORING.marginM
        ? 'bajo'
        : safeMaxM != null && p.m > safeMaxM - MOORING.marginM
          ? 'alto'
          : null;
    if (!kind) continue;
    const date = p.time.slice(0, 10);
    const key = `${date}|${kind}`;
    const g = groups.get(key) ?? { kind, date, hours: [] };
    g.hours.push(p);
    groups.set(key, g);
  }

  return [...groups.values()]
    .sort((a, b) => a.hours[0].time.localeCompare(b.hours[0].time))
    .map(({ kind, date, hours }) => {
      const bajo = kind === 'bajo';
      const extreme = bajo ? Math.min(...hours.map((h) => h.m)) : Math.max(...hours.map((h) => h.m));
      const first = hours[0].time;
      const last = hours[hours.length - 1].time;
      const cuando =
        first === last ? `cerca de las ${hourLabel(first)}` : `entre las ${hourLabel(first)} y las ${hourLabel(last)}`;
      return {
        type: bajo ? 'bajante' : 'sudestada',
        startsAt: first,
        endsAt: last,
        durationH: hours.length,
        severity: 2,
        confidence: MOORING.confidence,
        avgWindKt: 0,
        source: 'amarra',
        days: [{ date, hours: hours.length, severity: 2 }],
        message: bajo
          ? extreme < safeMinM!
            ? `Posible poca agua en tu amarra: el nivel podría bajar a ~${fmtM(extreme)} (tu mínimo es ${fmtM(safeMinM!)}) ${cuando}.`
            : `Posible poca agua en tu amarra: el nivel podría quedar en ~${fmtM(extreme)}, al límite de tu mínimo (${fmtM(safeMinM!)}), ${cuando}.`
          : extreme > safeMaxM!
            ? `Posible agua alta en tu amarra: el nivel podría llegar a ~${fmtM(extreme)} (tu máximo es ${fmtM(safeMaxM!)}) ${cuando}.`
            : `Posible agua alta en tu amarra: el nivel podría llegar a ~${fmtM(extreme)}, al límite de tu máximo (${fmtM(safeMaxM!)}), ${cuando}.`,
      } satisfies SurgeAlert;
    });
}

/**
 * Alertas de agua a mostrar. Si hay avisos de la amarra (o sea: hay rango seguro y
 * se pudo anclar el modelo, aunque no haya ningún aviso), reemplazan a las
 * regionales, salvo los días de sudestada/bajante SEVERA, que se mantienen: son
 * eventos del río entero que importan más allá de la amarra.
 * `mooring` null = no se pudo estimar la amarra → quedan las regionales.
 */
export function combineWaterAlerts(regional: SurgeAlert[], mooring: SurgeAlert[] | null): SurgeAlert[] {
  if (mooring == null) return regional;
  const severe = regional
    .map((a) => ({ ...a, days: a.days?.filter((d) => d.severity >= 3) ?? [] }))
    .filter((a) => a.severity >= 3 && a.days.length > 0);
  return [...mooring, ...severe].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
