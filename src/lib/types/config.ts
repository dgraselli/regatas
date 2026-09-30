/** Definiciones de configuración: clubs, rutas y barco. */

/** Tipo de propulsión de la embarcación. Cambia el scoring y el cálculo del cruce. */
export type Propulsion = 'vela' | 'motor';

export interface Club {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** IANA timezone, p.ej. 'America/Argentina/Buenos_Aires'. */
  timezone: string;
  notes?: string;
}

export interface RoutePoint {
  name: string;
  lat: number;
  lon: number;
}

export interface Route {
  id: string;
  name: string;
  /** Distancia total aproximada en millas náuticas (referencia). */
  approxNm: number;
  /** Waypoints ordenados desde el origen hasta el destino. */
  waypoints: RoutePoint[];
  timezone: string;
}

/**
 * Polar simplificada del velero. Para cada ángulo real al viento (TWA, grados)
 * tenemos la velocidad del barco (nudos) según la intensidad del viento (TWS, nudos).
 * Se interpola bilinealmente entre los puntos de la grilla.
 */
export interface BoatPolar {
  /** Ángulos al viento de la grilla, en grados (0 = de proa). Ascendente. */
  twaPoints: number[];
  /** Intensidades de viento de la grilla, en nudos. Ascendente. */
  twsPoints: number[];
  /**
   * Matriz de velocidades del barco en nudos.
   * speeds[i][j] = velocidad con twaPoints[i] y twsPoints[j].
   */
  speeds: number[][];
}

export interface ScoringThresholds {
  /** Viento ideal (nudos): por debajo es flojo, por encima empieza a ser mucho. */
  idealWindMin: number;
  idealWindMax: number;
  /** Viento fuerte: a partir de acá el día es amarillo. */
  strongWind: number;
  /** Viento peligroso: a partir de acá el día es rojo. */
  dangerWind: number;
  /** Ráfaga que vuelve el día amarillo. */
  gustYellow: number;
  /** Ráfaga que vuelve el día rojo. */
  gustRed: number;
  /** Lluvia (mm/día) que penaliza a amarillo. */
  rainYellow: number;
  /** Lluvia (mm/día) que penaliza a rojo. */
  rainRed: number;
  /** Visibilidad (m) que vuelve el día amarillo (visibilidad reducida / neblina). */
  fogYellowM: number;
  /** Visibilidad (m) que vuelve el día rojo (niebla). */
  fogRedM: number;
  /** Altura de ola (m) que vuelve el día amarillo (olas moderadas). */
  waveYellowM: number;
  /** Altura de ola (m) que vuelve el día rojo (olas grandes). */
  waveRedM: number;
}

export interface SurgeThresholds {
  /** Nivel del mar filtrado a 25 h (Marine, m) a partir del cual hay agua alta. */
  seaLevelHighM: number;
  /** Nivel del mar filtrado a 25 h (Marine, m) por debajo del cual hay agua baja. */
  seaLevelLowM: number;
  /** Cortes de severidad 2 y 3 del agua alta. */
  seaLevelHighSevM: [number, number];
  /** Cortes de severidad 2 y 3 del agua baja. */
  seaLevelLowSevM: [number, number];
  /** Horas mínimas por encima/debajo del umbral para alertar. */
  seaLevelMinHours: number;
  /** Respaldo por viento: sector de sudestada [min, max] en grados. */
  sudestadaSector: [number, number];
  /** Respaldo por viento: sector de bajante. Puede cruzar el 0. */
  bajanteSector: [number, number];
  /** Respaldo por viento: velocidad mínima sostenida (nudos). */
  minWindKt: number;
  /** Respaldo por viento: horas consecutivas mínimas. */
  minHours: number;
}

export interface RoutingConfig {
  /** Ángulo de la zona muerta: por debajo de este TWA hay que ceñir/virar. */
  noGoAngle: number;
  /** Penalización de velocidad al navegar en zona muerta (factor 0..1 sobre VMG). */
  tackingEfficiency: number;
  /** Ráfaga (nudos) a partir de la cual se advierte tomar rizos. */
  reefGust: number;
}
