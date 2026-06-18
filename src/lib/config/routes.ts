import type { Route } from '@/lib/types/config';
import { TIMEZONE } from '@/lib/config/clubs';

/**
 * Ruta del cruce La Plata → Colonia del Sacramento.
 * Waypoints aproximados a lo largo de la derrota (~26 NM / ~48 km).
 * El pronóstico de viento se muestrea en el punto medio (la grilla de
 * Open-Meteo es gruesa), pero la estructura permite muestrear por waypoint.
 */
export const ROUTES: Route[] = [
  {
    id: 'laplata-colonia',
    name: 'La Plata → Colonia',
    approxNm: 23,
    timezone: TIMEZONE,
    waypoints: [
      { name: 'Mi amarra (La Plata)', lat: -34.839876, lon: -57.923381 },
      { name: 'Medio del Río', lat: -34.65, lon: -57.88 },
      { name: 'Aprox. Colonia', lat: -34.5, lon: -57.86 },
      { name: 'Colonia del Sacramento', lat: -34.47, lon: -57.84 },
    ],
  },
];

export const DEFAULT_ROUTE_ID = 'laplata-colonia';

export function getRoute(id: string): Route {
  return ROUTES.find((r) => r.id === id) ?? ROUTES[0];
}
