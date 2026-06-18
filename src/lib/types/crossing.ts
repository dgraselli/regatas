/** Modelo de dominio del planificador de cruce. */

export type PointOfSail =
  | 'en irons' // dentro de la zona muerta (hay que virar)
  | 'ceñida'
  | 'través'
  | 'aleta'
  | 'popa';

export interface Leg {
  fromName: string;
  toName: string;
  /** Rumbo de la derrota en grados verdaderos. */
  bearing: number;
  /** Distancia del tramo en millas náuticas. */
  distanceNm: number;
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
  /** Duración estimada del tramo en horas. */
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
