import type {
  BoatPolar,
  ScoringThresholds,
  SurgeThresholds,
  RoutingConfig,
} from '@/lib/types/config';

/** Datos del barco del usuario. */
export const BOAT = {
  name: 'Plenamar New 23',
  lengthFt: 23,
};

/**
 * Polar del Plenamar New 23 (velero de ~23 pies, eslora ~7 m).
 * Velocidad de casco ~5,8-6 kt; ciñe algo peor que un crucero grande y arranca
 * más lento con viento flojo. Valores estimados (no medidos) — ajustar con datos
 * reales del barco si se dispone. speeds[i][j] en nudos para twaPoints[i] / twsPoints[j].
 */
export const DEFAULT_POLAR: BoatPolar = {
  twaPoints: [0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180],
  twsPoints: [5, 10, 15, 20, 25],
  speeds: [
    [0.0, 0.0, 0.0, 0.0, 0.0], // 0  - de proa, zona muerta
    [0.0, 0.0, 0.0, 0.0, 0.0], // 30 - zona muerta
    [0.0, 0.0, 0.0, 0.0, 0.0], // 40 - todavía en zona muerta (ciñe peor)
    [3.4, 4.4, 4.9, 5.1, 5.1], // 52 - ceñida
    [3.7, 4.7, 5.2, 5.4, 5.4], // 60
    [3.9, 4.9, 5.4, 5.6, 5.6], // 75
    [4.0, 5.0, 5.5, 5.7, 5.7], // 90 - través
    [3.8, 4.9, 5.4, 5.7, 5.8], // 110
    [3.5, 4.7, 5.3, 5.6, 5.8], // 120 - aleta
    [3.1, 4.3, 4.9, 5.4, 5.7], // 135
    [2.6, 3.8, 4.5, 5.0, 5.4], // 150
    [2.1, 3.2, 3.9, 4.4, 4.9], // 165
    [1.9, 2.9, 3.6, 4.1, 4.6], // 180 - popa
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
  // El Plenamar 23 ciñe peor que un crucero grande y conviene tomar rizos antes.
  noGoAngle: 45,
  tackingEfficiency: 0.6,
  reefGust: 23,
};

/** Hora local aproximada de salida y puesta de sol para flags de "llega de noche". */
export const DAYLIGHT = {
  sunriseHour: 7,
  sunsetHour: 19,
};
