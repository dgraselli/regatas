/** Modelo de dominio del pronóstico (normalizado, independiente de la API). */

export interface HourlyPoint {
  /** ISO timestamp en hora local del club. */
  time: string;
  /** Velocidad del viento a 10m, en nudos. */
  windKt: number;
  /** Ráfagas a 10m, en nudos. */
  gustKt: number;
  /** Dirección del viento (de dónde viene), en grados 0..360. */
  windDir: number;
  /** Precipitación en mm. */
  precipMm: number;
  /** Temperatura en °C. */
  tempC: number;
  /** Visibilidad horizontal en metros, si está disponible. Bajo = posible niebla. */
  visibilityM?: number;
  /** Nivel del mar respecto al MSL (m), si está disponible (Marine API). */
  seaLevelM?: number;
}

export type TrafficLevel = 'verde' | 'poco-viento' | 'amarillo' | 'rojo';

export interface DayScore {
  /** Fecha YYYY-MM-DD en hora local. */
  date: string;
  level: TrafficLevel;
  /** Motivos legibles (en español) que explican el nivel. */
  reasons: string[];
  metrics: {
    windMedianKt: number;
    gustPeakKt: number;
    windDirDominant: number;
    precipTotalMm: number;
    tempMinC: number;
    tempMaxC: number;
    /** Visibilidad mínima del día (m) en horas de luz, si hay dato. */
    visibilityMinM?: number;
  };
}

export interface ForecastBundle {
  club: { id: string; name: string; lat: number; lon: number; timezone: string };
  /** Momento en que se obtuvo el pronóstico. */
  fetchedAt: string;
  hourly: HourlyPoint[];
  days: DayScore[];
}

/**
 * Alerta de niebla / visibilidad reducida: una ventana de horas consecutivas con
 * visibilidad baja. Análoga a las alertas de marea, pero centrada en visibilidad.
 */
export interface FogAlert {
  /** ISO timestamp local de inicio de la ventana. */
  startsAt: string;
  /** ISO timestamp local de fin de la ventana. */
  endsAt: string;
  /** Duración en horas. */
  durationH: number;
  /** 1 = visibilidad reducida (neblina), 2 = niebla. */
  severity: 1 | 2;
  /** Visibilidad mínima de la ventana (m). */
  minVisibilityM: number;
  /** Confianza 0..1 (la niebla es poco confiable, así que es baja a propósito). */
  confidence: number;
  /** Mensaje legible en español. */
  message: string;
}
