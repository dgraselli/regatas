import type { ScoringThresholds, SurgeThresholds } from '@/lib/types/config';
import { generatePolar, deriveRouting } from '@/lib/domain/polarModel';

/** Eslora por defecto al crear un barco nuevo (pies). */
export const DEFAULT_LENGTH_FT = 23;

/** Velocidad de crucero por defecto de una embarcación a motor (nudos). */
export const DEFAULT_CRUISE_KT = 12;

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
  fogYellowM: 4000,
  fogRedM: 1000,
  // Altura de ola significativa (m). En el estuario la ola es corta y empinada;
  // ~1 m ya incomoda a un barco chico y ~1.75 m es mar duro.
  waveYellowM: 1.0,
  waveRedM: 1.75,
};

/**
 * Umbrales del semáforo ajustados al nivel de tolerancia al riesgo. La tolerancia
 * solo mueve los umbrales de viento fuerte / ráfagas / lluvia (cuánto "de más" se
 * tolera). El umbral de viento mínimo (`idealWindMin`, que marca "poco viento") es
 * constante: ser audaz no hace que haya viento donde no lo hay.
 */
export function scoringFor(caution: 'prudente' | 'normal' | 'audaz'): ScoringThresholds {
  if (caution === 'prudente') {
    return { ...SCORING, strongWind: 18, dangerWind: 24, gustYellow: 22, gustRed: 28, rainYellow: 1, rainRed: 8, fogYellowM: 6000, fogRedM: 2000, waveYellowM: 0.75, waveRedM: 1.25 };
  }
  if (caution === 'audaz') {
    return { ...SCORING, strongWind: 26, dangerWind: 33, gustYellow: 30, gustRed: 38, rainYellow: 4, rainRed: 16, fogYellowM: 2000, fogRedM: 500, waveYellowM: 1.25, waveRedM: 2.25 };
  }
  return SCORING;
}

/**
 * Marea meteorológica (sudestada / bajante). Calibrado el 2026-09-30 contra el
 * nivel OBSERVADO de los mareógrafos (validation/nivel-observado.jsonl, jun–sep
 * 2026, `node scripts/nivel-eval.mjs report`).
 *
 * Método principal: el nivel del mar de Open-Meteo Marine filtrado a 25 h (la
 * media móvil cancela la marea astronómica semidiurna y deja la meteorológica).
 * Sigue al residuo observado de La Plata / Buenos Aires con r = 0.96, y con
 * hasta 5 días de anticipación todavía r = 0.93: detectó 24 de 25 días de agua
 * alta (≥ +0.5 m) y 11 de 11 de agua baja (≤ −0.5 m), con 2-5 falsas alarmas.
 * Los umbrales están en la escala de Marine (MSL del modelo, cuya mediana en el
 * estuario es ~+0.17 m); la conversión aproximada al mareógrafo es
 * `anomalía ≈ 1.26 × nivel − 0.20`.
 *
 * Respaldo sólo por viento, si Marine no responde: el sector y la persistencia
 * viejos (SE 112-157°, ≥ 18 kt, ≥ 6 h) no detectaban NINGUNO de esos eventos.
 * Lo que mejor explica la subida es viento del S-SSE (165-175°) acumulado en
 * 12-18 h; con el viento del punto de la amarra la regla de abajo detecta 8 de
 * 25 sin falsas alarmas: es un respaldo pobre, pero no inventa.
 */
export const SURGE: SurgeThresholds = {
  seaLevelHighM: 0.45,
  seaLevelLowM: -0.15,
  /** Severidad 2 / 3 del agua alta (nivel filtrado, m). */
  seaLevelHighSevM: [0.6, 0.75],
  /**
   * Severidad 2 / 3 del agua baja (nivel filtrado, m). Marine se queda corto con
   * las bajantes: del lado negativo el mareógrafo da ≈ 1.14 × nivel − 0.25
   * (ago–nov 2026, BA y La Plata). Con −0.20 la marcada (amarillo) equivale a
   * ~−0.48 m medidos; todos los días ≤ −0.20 bajaron entre −0.43 y −0.89 m.
   * Antes (−0.25) la bajante del 3/10 (−0.58 m) salía leve.
   */
  seaLevelLowSevM: [-0.2, -0.35],
  seaLevelMinHours: 3,
  /**
   * Un día cuenta como afectado si el evento lo cubre ≥ 6 h. Validado contra el
   * mareógrafo (oct–nov 2026): pintar cada día que el evento tocaba, con la
   * severidad del pico, daba 8 de 35 días en alerta con el agua < +0.3 m (las
   * puntas de eventos de 50-90 h, a veces con 2 h dentro del día).
   */
  dayMinHours: 6,
  // Respaldo por viento (de dónde viene).
  sudestadaSector: [150, 210],
  bajanteSector: [292, 22],
  minWindKt: 10,
  minHours: 6,
};

/**
 * Nivel estimado EN LA AMARRA (escala del mareógrafo) para los próximos días, y
 * aviso cuando sale del rango seguro que cargó el usuario. Ver
 * `src/lib/domain/mooringLevel.ts`.
 *
 * Validado contra los pronósticos que Open-Meteo emitió 1 a 6 días antes
 * (`sea_level_height_msl_previous_dayN`) y el mareógrafo de San Fernando y
 * Buenos Aires (jun–nov 2026, SHN e INA). Sin corregir, el modelo achica la
 * marea, la adelanta ~1-2 h y se queda muy corto con las bajantes: avisaba 1 de
 * cada 6-10 días de agua baja. Con esta corrección el nivel queda sin sesgo
 * (error medio en la pleamar/bajamar del día ~0.2 m, casi igual a 1 que a 6 días)
 * y, con un rango que deja afuera el 10 % más bajo y el 10 % más alto, avisa
 * ~75-90 % de los días fuera de rango y ~65-75 % de los avisos se cumplen.
 */
export const MOORING = {
  /** El modelo adelanta la marea: su valor de las H vale para las H + lagH. */
  lagH: 2,
  /** Factor sobre la marea astronómica (nivel − media de 25 h): el modelo la achica. */
  tideAmp: 1.2,
  /** Por debajo de este nivel filtrado (Marine, m) la bajante se amplifica… */
  lowKneeM: 0.2,
  /** …por este factor: el modelo marca la mitad de lo que baja el río. */
  lowGain: 2.0,
  /** Horas de medición (las más recientes) con que se ancla el modelo al cero del mareógrafo. */
  calibHours: 72,
  /** Mínimo de horas medidas que coinciden con el modelo para poder anclar. */
  minCalibHours: 24,
  /**
   * Se avisa cuando el nivel estimado queda a menos de esto del límite (m). Con
   * 0 se perdían ~30 % de los eventos; con 0.2 la mitad de los avisos de agua alta
   * eran falsos. 0.1 es el compromiso.
   */
  marginM: 0.1,
  /** Confianza que se muestra en el aviso (proporción de avisos que se cumplieron). */
  confidence: 0.65,
};

/** Hora local aproximada de salida y puesta de sol para flags de "llega de noche". */
export const DAYLIGHT = {
  sunriseHour: 7,
  sunsetHour: 19,
};
