import { haversineNm } from '@/lib/domain/geo';

/**
 * Aeropuertos con METAR (observación horaria de visibilidad) del Río de la Plata.
 * `icao` es el código de estación que se le pide al proxy (`/api/metar?ids=…`).
 * Cobertura floja en Colonia/Carmelo (reporte irregular).
 */
export interface MetarStation {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

export const METAR_STATIONS: MetarStation[] = [
  { icao: 'SABE', name: 'Aeroparque', lat: -34.559, lon: -58.416 },
  { icao: 'SAEZ', name: 'Ezeiza', lat: -34.822, lon: -58.536 },
  { icao: 'SADF', name: 'San Fernando', lat: -34.453, lon: -58.589 },
  { icao: 'SADP', name: 'El Palomar', lat: -34.61, lon: -58.612 },
  { icao: 'SADL', name: 'La Plata', lat: -34.972, lon: -57.895 },
  { icao: 'SUMU', name: 'Carrasco (Montevideo)', lat: -34.838, lon: -56.008 },
  { icao: 'SUCA', name: 'Colonia', lat: -34.456, lon: -57.771 },
];

/** Estación METAR más cercana a un punto (por distancia great-circle). */
export function nearestMetarStation(lat: number, lon: number): MetarStation {
  return METAR_STATIONS.reduce((best, s) =>
    haversineNm(lat, lon, s.lat, s.lon) < haversineNm(lat, lon, best.lat, best.lon) ? s : best,
  );
}
