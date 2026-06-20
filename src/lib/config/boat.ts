import type { ScoringThresholds, SurgeThresholds } from '@/lib/types/config';
import { generatePolar, deriveRouting } from '@/lib/domain/polarModel';

/** Eslora por defecto al crear un barco nuevo (pies). */
export const DEFAULT_LENGTH_FT = 23;

/**
 * Polar y parámetros de navegación por defecto, derivados de la eslora.
 * Cada barco del usuario genera los suyos a partir de su eslora; estos sirven
 * como valores por defecto cuando no hay barco seleccionado.
 */
export const DEFAULT_POLAR = generatePolar(DEFAULT_LENGTH_FT);
export const ROUTING = deriveRouting(DEFAULT_LENGTH_FT);

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

/** Umbrales del semáforo ajustados al nivel de tolerancia al riesgo. */
export function scoringFor(caution: 'prudente' | 'normal' | 'audaz'): ScoringThresholds {
  if (caution === 'prudente') {
    return { ...SCORING, strongWind: 18, dangerWind: 24, gustYellow: 22, gustRed: 28, rainYellow: 1, rainRed: 8 };
  }
  if (caution === 'audaz') {
    return { ...SCORING, idealWindMin: 5, strongWind: 26, dangerWind: 33, gustYellow: 30, gustRed: 38, rainYellow: 4, rainRed: 16 };
  }
  return SCORING;
}

export const SURGE: SurgeThresholds = {
  // Sudestada: viento del sector SE (de dónde viene).
  sudestadaSector: [112, 157],
  // Bajante: viento del N / NW (de dónde viene). Cruza el 0 (de 292° a 22°).
  bajanteSector: [292, 22],
  minWindKt: 18,
  minHours: 6,
};

/** Hora local aproximada de salida y puesta de sol para flags de "llega de noche". */
export const DAYLIGHT = {
  sunriseHour: 7,
  sunsetHour: 19,
};
