import type { Route, RoutePoint } from '@/lib/types/config';
import { TIMEZONE } from '@/lib/profile/defaults';
import { haversineNm } from '@/lib/domain/geo';

/**
 * Construye una ruta entre dos puntos cualesquiera (la amarra del usuario y un
 * destino), con un waypoint intermedio en el medio para muestrear el viento.
 */
export function buildRoute(from: RoutePoint, to: RoutePoint): Route {
  const mid: RoutePoint = {
    name: 'Medio del cruce',
    lat: (from.lat + to.lat) / 2,
    lon: (from.lon + to.lon) / 2,
  };
  const approxNm = Math.round(haversineNm(from.lat, from.lon, to.lat, to.lon));
  return {
    id: `${slug(from.name)}-${slug(to.name)}`,
    name: `${from.name} → ${to.name}`,
    approxNm,
    timezone: TIMEZONE,
    waypoints: [from, mid, to],
  };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
