/** Perfil del usuario, guardado en el navegador (localStorage). Sin registro. */

export interface Boat {
  id: string;
  name: string;
  /** Eslora en pies; de acá se genera la polar aproximada. */
  lengthFt: number;
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

export interface Profile {
  version: number;
  boats: Boat[];
  locations: SavedLocation[];
  activeBoatId: string | null;
  /** Lugar de referencia del panel (típicamente la amarra). */
  activeLocationId: string | null;
  caution: Caution;
}
