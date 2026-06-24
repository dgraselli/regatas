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
