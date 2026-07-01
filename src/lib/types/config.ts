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
}

export interface SurgeThresholds {
  /** Sector de viento del SE (sudestada): [min, max] en grados. */
  sudestadaSector: [number, number];
  /** Sector de viento del N/NW (bajante). Puede cruzar el 0. */
  bajanteSector: [number, number];
  /** Velocidad mínima de viento sostenido (nudos) para considerar el evento. */
  minWindKt: number;
  /** Horas consecutivas mínimas para disparar la alerta. */
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
