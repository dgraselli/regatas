/** Modelo de dominio para nivel de agua y alertas de marea meteorológica. */

export type SurgeType = 'sudestada' | 'bajante';

export interface SurgeDay {
  /** Fecha local 'YYYY-MM-DD'. */
  date: string;
  /** Horas del evento que caen en ese día. */
  hours: number;
  /** Severidad de ese día: 1 (leve) .. 3 (severa). */
  severity: 1 | 2 | 3;
}

export interface SurgeAlert {
  type: SurgeType;
  /** ISO timestamp local de inicio del evento. */
  startsAt: string;
  /** ISO timestamp local de fin del evento. */
  endsAt: string;
  /** Duración en horas. */
  durationH: number;
  /** Severidad 1 (leve) .. 3 (severa). */
  severity: 1 | 2 | 3;
  /** Confianza 0..1 (mayor si el nivel del mar corrobora). */
  confidence: number;
  /** Viento medio sostenido del evento (nudos). */
  avgWindKt: number;
  /** De qué sale la alerta: el nivel del mar pronosticado o, sin él, sólo el viento. */
  source: 'nivel' | 'viento';
  /**
   * Cuánto se estima que se aparta el agua de lo normal en el pico (m, con
   * signo), en la escala del mareógrafo. Sólo si la alerta sale del nivel.
   */
  anomalyM?: number;
  /**
   * Días que el evento afecta de verdad, cada uno con SU severidad (el pico del
   * nivel en las horas de ese día, no el del evento entero). Un día sólo entra si
   * el evento lo cubre al menos `SURGE.dayMinHours` (o el evento entero, si es
   * más corto): así la punta de un evento largo no pinta un día casi sin agua.
   */
  days: SurgeDay[];
  /** Mensaje legible en español. */
  message: string;
}

export interface WaterLevelObservation {
  /** ISO timestamp local. */
  time: string;
  /** Altura del agua en metros (referida al datum de la estación). */
  heightM: number;
}

export interface WaterLevelStatus {
  stationName: string;
  /** Observaciones recientes (orden cronológico). */
  observations: WaterLevelObservation[];
  /** Tendencia simple sobre las últimas observaciones. */
  trend: 'subiendo' | 'bajando' | 'estable';
  fetchedAt: string;
}
