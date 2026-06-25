/** Modelo de dominio del planificador de cruce. */

import type { TrafficLevel } from '@/lib/types/forecast';

export type PointOfSail =
  | 'en irons' // dentro de la zona muerta (hay que virar)
  | 'ceñida'
  | 'través'
  | 'aleta'
  | 'popa';

/**
 * Tramo de la simulación: un cruce directo tiene un solo rumbo, así que cada
 * `Leg` representa un intervalo de ~1 hora de navegación sobre esa derrota,
 * mostrando cómo evolucionan el viento y la velocidad durante el cruce.
 */
export interface Leg {
  /** Hora local (ISO 'YYYY-MM-DDTHH:mm') del comienzo del tramo. */
  time: string;
  /** Dirección del viento (de dónde viene) en el tramo, grados. */
  windDir: number;
  /** Intensidad del viento en el tramo (nudos). */
  windKt: number;
  /** Ráfagas estimadas en el tramo (nudos). */
  gustKt: number;
  /** Ángulo real al viento (TWA) en grados, 0..180. */
  twa: number;
  pointOfSail: PointOfSail;
  /** Velocidad estimada del barco en el tramo (nudos). */
  boatKt: number;
  /** Distancia recorrida en este tramo (millas náuticas). */
  segmentNm: number;
  /** Distancia acumulada al final del tramo (millas náuticas). */
  cumulativeNm: number;
  /** Duración del tramo en horas (≤ 1). */
  hours: number;
  /** Advertencias del tramo (en español). */
  warnings: string[];
}

export interface DepartureCandidate {
  /** ISO timestamp local de salida. */
  departAt: string;
  /** ISO timestamp local de llegada estimada. */
  arriveAt: string;
  /** Duración total en horas. */
  totalHours: number;
  /** Rumbo constante de la derrota directa (grados verdaderos). */
  course: number;
  /** Distancia total del cruce (millas náuticas). */
  distanceNm: number;
  /** ¿Completa el cruce dentro del horizonte simulado? */
  completes: boolean;
  /** Semáforo de seguridad de esta salida (misma escala que el panel del día). */
  level: TrafficLevel;
  legs: Leg[];
  warnings: string[];
  /** Costo usado para el ranking (menor es mejor). */
  cost: number;
  /** Llega después del atardecer / de noche. */
  arrivesAtNight: boolean;
}

export interface CrossingPlan {
  routeId: string;
  routeName: string;
  /** Mejor candidato según el ranking. */
  best: DepartureCandidate | null;
  /** Todos los candidatos ordenados por costo ascendente. */
  ranked: DepartureCandidate[];
  computedAt: string;
}
