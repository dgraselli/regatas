import { haversineNm } from '@/lib/domain/geo';

/**
 * Estaciones del INA — Sistema de Alerta Hidrológico (API pública "a5",
 * https://alerta.ina.gob.ar/a5). `seriesId` es el id de serie de la variable
 * "Altura hidrométrica" (var=2, en metros) que se consulta en
 * `/a5/obs/puntual/series/{seriesId}/observaciones`.
 *
 * Se eligieron estaciones del Río de la Plata con registro automático (frecuencia
 * ~horaria); se descartaron las de carga manual (pocos datos por día).
 */
export interface InaStation {
  seriesId: number;
  name: string;
  lat: number;
  lon: number;
}

export const INA_STATIONS: InaStation[] = [
  { seriesId: 3314, name: 'La Plata', lat: -34.834, lon: -57.88 },
  { seriesId: 3345, name: 'Pilote Norden', lat: -34.626, lon: -57.927 },
  { seriesId: 85, name: 'Buenos Aires', lat: -34.561, lon: -58.399 },
  { seriesId: 52, name: 'San Fernando', lat: -34.433, lon: -58.55 },
  { seriesId: 3344, name: 'Atalaya', lat: -35.015, lon: -57.536 },
];

/** Estación del INA más cercana a un punto (por distancia great-circle). */
export function nearestStation(lat: number, lon: number): InaStation {
  return INA_STATIONS.reduce((best, s) =>
    haversineNm(lat, lon, s.lat, s.lon) < haversineNm(lat, lon, best.lat, best.lon) ? s : best,
  );
}
