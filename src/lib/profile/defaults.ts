import type { Profile } from '@/lib/profile/types';

export const TIMEZONE = 'America/Argentina/Buenos_Aires';
export const PROFILE_VERSION = 1;

/**
 * Perfil inicial para un usuario nuevo. Trae lugares conocidos del Río de la
 * Plata como punto de partida; el usuario edita/agrega los suyos.
 */
export const DEFAULT_PROFILE: Profile = {
  version: PROFILE_VERSION,
  boats: [],
  locations: [
    {
      id: 'colonia',
      name: 'Colonia del Sacramento (UY)',
      lat: -34.47,
      lon: -57.84,
      kind: 'destino',
      timezone: TIMEZONE,
    },
    {
      id: 'buenos-aires',
      name: 'Buenos Aires (costa)',
      lat: -34.6,
      lon: -58.37,
      kind: 'punto',
      timezone: TIMEZONE,
    },
  ],
  activeBoatId: null,
  activeLocationId: null,
  caution: 'normal',
};
