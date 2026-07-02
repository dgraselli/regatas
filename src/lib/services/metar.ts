import { getJson, USE_MOCKS } from '@/lib/services/http';
import { normalizeMetar, type MetarObservation, type MetarRaw } from '@/lib/domain/metar';
import { nearestMetarStation } from '@/lib/config/metarStations';
import { haversineNm } from '@/lib/domain/geo';
import { mockMetar } from '@/mocks/handlers';

export interface MetarStatus {
  observation: MetarObservation;
  /** Distancia del aeropuerto al lugar del usuario (km). */
  distanceKm: number;
}

/**
 * Observación METAR más reciente del aeropuerto más cercano al lugar. Pasa por el
 * proxy propio (`/api/metar`, Cloudflare Worker) porque la API no trae CORS. Si el
 * proxy no está disponible (Worker sin desplegar, localhost, sin datos), devuelve
 * `null` y la UI simplemente no muestra la tarjeta: es un dato complementario.
 */
export async function getMetarObservation(loc: {
  lat: number;
  lon: number;
}): Promise<MetarStatus | null> {
  const station = nearestMetarStation(loc.lat, loc.lon);
  const distanceKm = Math.round(haversineNm(loc.lat, loc.lon, station.lat, station.lon) * 1.852);
  try {
    const raw = USE_MOCKS
      ? mockMetar(station.icao)
      : await getJson<MetarRaw[]>(`/api/metar?ids=${station.icao}&hours=2`);
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const latest = raw
      .map(normalizeMetar)
      .filter((o) => o.time != null)
      .sort((a, b) => (a.time! < b.time! ? 1 : -1))[0];
    if (!latest) return null;
    return {
      observation: { ...latest, name: latest.name ?? station.name },
      distanceKm,
    };
  } catch {
    return null;
  }
}
