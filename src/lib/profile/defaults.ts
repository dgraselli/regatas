import { haversineNm } from '@/lib/domain/geo';
import type { Profile, SavedLocation } from '@/lib/profile/types';

export const TIMEZONE = 'America/Argentina/Buenos_Aires';
export const PROFILE_VERSION = 1;

/** Lugar activo de respaldo cuando no hay geolocalización disponible. */
export const FALLBACK_LOCATION_ID = 'la-plata';

/**
 * Lugares que vienen cargados por defecto para un usuario nuevo: los puntos
 * más usados del Río de la Plata. Coordenadas aproximadas (nivel localidad /
 * puerto); el usuario edita/agrega los suyos en el perfil.
 */
export const DEFAULT_LOCATIONS: SavedLocation[] = [
  // Argentina
  { id: 'buenos-aires', name: 'Buenos Aires', lat: -34.6, lon: -58.37, kind: 'amarra', timezone: TIMEZONE },
  { id: 'la-plata', name: 'La Plata', lat: -34.858, lon: -57.905, kind: 'amarra', timezone: TIMEZONE },
  // Uruguay
  { id: 'colonia', name: 'Colonia', lat: -34.47, lon: -57.84, kind: 'destino', timezone: TIMEZONE },
  { id: 'riachuelo', name: 'Riachuelo', lat: -34.433, lon: -57.72, kind: 'destino', timezone: TIMEZONE },
  { id: 'sauce', name: 'Sauce', lat: -34.435, lon: -57.452, kind: 'destino', timezone: TIMEZONE },
  { id: 'carmelo', name: 'Carmelo', lat: -33.997, lon: -58.293, kind: 'destino', timezone: TIMEZONE },
];

/**
 * El lugar más cercano a una coordenada dada, de una lista de lugares. Sirve
 * para elegir el lugar activo según la geolocalización del navegador. Devuelve
 * null si la lista está vacía.
 */
export function nearestLocationId(
  locations: SavedLocation[],
  lat: number,
  lon: number,
): string | null {
  let bestId: string | null = null;
  let bestNm = Infinity;
  for (const l of locations) {
    const d = haversineNm(lat, lon, l.lat, l.lon);
    if (d < bestNm) {
      bestNm = d;
      bestId = l.id;
    }
  }
  return bestId;
}

/**
 * Perfil inicial para un usuario nuevo. Trae lugares conocidos del Río de la
 * Plata como punto de partida; el usuario edita/agrega los suyos. El lugar
 * activo arranca en La Plata y, si el navegador da geolocalización, se ajusta
 * al lugar más cercano (ver `ProfileProvider`).
 */
export const DEFAULT_PROFILE: Profile = {
  version: PROFILE_VERSION,
  boats: [],
  locations: DEFAULT_LOCATIONS,
  activeBoatId: null,
  activeLocationId: FALLBACK_LOCATION_ID,
  caution: 'normal',
};
