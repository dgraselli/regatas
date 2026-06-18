import type { Club } from '@/lib/types/config';

export const TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Clubs / puntos de referencia. La Plata es el punto fijo por defecto.
 * Coordenadas aproximadas; ajustar al club real del usuario.
 */
export const CLUBS: Club[] = [
  {
    id: 'la-plata',
    name: 'Mi amarra (La Plata)',
    lat: -34.839876,
    lon: -57.923381,
    timezone: TIMEZONE,
    notes: 'Amarra propia. Punto de salida por defecto del cruce a Colonia.',
  },
  {
    id: 'buenos-aires',
    name: 'Buenos Aires (costa / dársena)',
    lat: -34.6,
    lon: -58.37,
    timezone: TIMEZONE,
  },
  {
    id: 'colonia',
    name: 'Colonia del Sacramento (UY)',
    lat: -34.47,
    lon: -57.84,
    timezone: TIMEZONE,
  },
];

export const DEFAULT_CLUB_ID = 'la-plata';

export function getClub(id: string): Club {
  return CLUBS.find((c) => c.id === id) ?? CLUBS[0];
}
