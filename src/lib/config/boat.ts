import type {
  BoatPolar,
  ScoringThresholds,
  SurgeThresholds,
  RoutingConfig,
} from '@/lib/types/config';

/**
 * Polar genérica de un crucero ~30-34 pies. Reemplazar por la polar real del
 * velero cuando se disponga. speeds[i][j] en nudos para twaPoints[i] / twsPoints[j].
 */
export const DEFAULT_POLAR: BoatPolar = {
  twaPoints: [0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180],
  twsPoints: [5, 10, 15, 20, 25],
  speeds: [
    [0.0, 0.0, 0.0, 0.0, 0.0], // 0  - de proa, zona muerta
    [0.0, 0.0, 0.0, 0.0, 0.0], // 30 - zona muerta
    [4.0, 5.2, 5.8, 6.0, 6.0], // 40 - límite de ceñida
    [4.8, 5.8, 6.2, 6.4, 6.3], // 52 - ceñida
    [5.0, 6.0, 6.5, 6.7, 6.6], // 60
    [5.2, 6.2, 6.8, 7.0, 7.0], // 75
    [5.3, 6.4, 7.0, 7.2, 7.3], // 90 - través
    [5.0, 6.2, 6.9, 7.2, 7.4], // 110
    [4.7, 6.0, 6.7, 7.1, 7.4], // 120 - aleta
    [4.2, 5.5, 6.3, 6.8, 7.2], // 135
    [3.6, 4.9, 5.7, 6.3, 6.8], // 150
    [3.0, 4.2, 5.0, 5.6, 6.2], // 165
    [2.8, 3.9, 4.7, 5.3, 5.9], // 180 - popa
  ],
};

export const SCORING: ScoringThresholds = {
  idealWindMin: 6,
  idealWindMax: 18,
  strongWind: 22,
  dangerWind: 28,
  gustYellow: 25,
  gustRed: 33,
  rainYellow: 2,
  rainRed: 12,
};

export const SURGE: SurgeThresholds = {
  // Sudestada: viento del sector SE (de dónde viene).
  sudestadaSector: [112, 157],
  // Bajante: viento del N / NW (de dónde viene). Cruza el 0 (de 292° a 22°).
  bajanteSector: [292, 22],
  minWindKt: 18,
  minHours: 6,
};

export const ROUTING: RoutingConfig = {
  noGoAngle: 40,
  tackingEfficiency: 0.65,
  reefGust: 28,
};

/** Hora local aproximada de salida y puesta de sol para flags de "llega de noche". */
export const DAYLIGHT = {
  sunriseHour: 7,
  sunsetHour: 19,
};
