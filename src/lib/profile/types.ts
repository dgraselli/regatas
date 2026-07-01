/** Perfil del usuario, guardado en el navegador (localStorage). Sin registro. */

import type { Propulsion } from '@/lib/types/config';

export type { Propulsion };

export interface Boat {
  id: string;
  name: string;
  /** Eslora en pies; de acá se genera la polar aproximada. */
  lengthFt: number;
  /**
   * Tipo de propulsión. Ausente = 'vela' (compatibilidad con perfiles viejos).
   * A vela el poco viento penaliza; a motor no (el agua tranquila es ideal) y el
   * cruce se calcula a velocidad de crucero constante, no con la polar.
   */
  propulsion?: Propulsion;
  /** Velocidad de crucero a motor (kt). Solo aplica si `propulsion === 'motor'`. */
  cruiseKt?: number;
}

export type LocationKind = 'amarra' | 'destino' | 'punto';

export interface SavedLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: LocationKind;
  timezone: string;
  /** Nivel de agua mínimo seguro de la amarra (m), opcional. Por debajo, riesgo de varar. */
  safeLevelMinM?: number;
  /** Nivel de agua máximo seguro de la amarra (m), opcional. Por encima, agua muy alta. */
  safeLevelMaxM?: number;
}

/** Nivel de tolerancia al riesgo, ajusta los umbrales del semáforo. */
export type Caution = 'prudente' | 'normal' | 'audaz';

/** Umbral de "poco viento" (kt) por defecto si el usuario no lo configuró. */
export const DEFAULT_LOW_WIND_KT = 6;

/** Última selección del planificador de cruce (para recordarla entre sesiones). */
export interface CrossingSelection {
  originId?: string | null;
  destId?: string | null;
  boatId?: string | null;
}

export interface Profile {
  version: number;
  boats: Boat[];
  locations: SavedLocation[];
  activeBoatId: string | null;
  /** Lugar de referencia del panel (típicamente la amarra). */
  activeLocationId: string | null;
  caution: Caution;
  /** Umbral de "poco viento" (kt) configurable; debajo, no se puede navegar a vela. */
  lowWindKt?: number;
  /** Salida/destino/barco recordados del cruce. */
  crossing?: CrossingSelection;
}
