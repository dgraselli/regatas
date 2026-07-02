import { DAYLIGHT } from '@/lib/config/boat';

/**
 * Amanecer y atardecer reales por fecha y posición (dominio puro, sin red).
 * Reemplaza las horas de luz fijas por las del día concreto en el lugar, usando
 * el algoritmo clásico del almanaque (USNO): mucho más realista en invierno
 * (cuando 7–19 fijo cuenta como "de día" una franja ya oscura) y en verano.
 */

const RAD = Math.PI / 180;
const norm360 = (x: number) => ((x % 360) + 360) % 360;
const norm24 = (x: number) => ((x % 24) + 24) % 24;

/**
 * El estuario del Plata (Argentina y Uruguay) está todo en UTC−3 y sin horario
 * de verano, así que el offset es fijo. Los timestamps de la app ya vienen en
 * esta hora local.
 */
export const RIO_PLATA_UTC_OFFSET_H = -3;

/** Día del año (1..366) de una fecha local 'YYYY-MM-DD'. */
function dayOfYear(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = Date.UTC(y, 0, 1);
  const cur = Date.UTC(y, m - 1, d);
  return Math.round((cur - start) / 86400000) + 1;
}

/**
 * Hora local (decimal) del amanecer o atardecer para una fecha y posición.
 * @param dateStr fecha local 'YYYY-MM-DD'
 * @param lat latitud en grados (norte +)
 * @param lon longitud en grados (este +)
 * @param rising true = amanecer, false = atardecer
 * @param tzOffsetH offset horario respecto de UTC (default −3, RdlP)
 * @returns hora local 0..24, o null si el sol no sale/pone ese día (zona polar)
 */
export function sunEvent(
  dateStr: string,
  lat: number,
  lon: number,
  rising: boolean,
  tzOffsetH: number = RIO_PLATA_UTC_OFFSET_H,
): number | null {
  // Zenit 90.833° = borde superior del sol + refracción atmosférica media.
  const zenith = 90.833;
  const N = dayOfYear(dateStr);
  const lngHour = lon / 15;
  const t = N + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * t - 3.289; // anomalía media del sol
  // Longitud verdadera del sol
  const L = norm360(M + 1.916 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 282.634);
  // Ascensión recta, alineada al mismo cuadrante que L
  let RA = norm360(Math.atan(0.91764 * Math.tan(L * RAD)) / RAD);
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
  RA /= 15;
  const sinDec = 0.39782 * Math.sin(L * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(zenith * RAD) - sinDec * Math.sin(lat * RAD)) / (cosDec * Math.cos(lat * RAD));
  if (cosH > 1 || cosH < -1) return null; // sol siempre bajo/sobre el horizonte
  const H = (rising ? 360 - Math.acos(cosH) / RAD : Math.acos(cosH) / RAD) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = norm24(T - lngHour);
  return norm24(UT + tzOffsetH);
}

/**
 * Ventana de horas de luz (horas enteras) para el filtro del scoring/cruce. Con
 * lugar, usa el amanecer/atardecer reales de la fecha; sin lugar (o zona polar),
 * cae al valor fijo `DAYLIGHT` para no romper el comportamiento por defecto.
 */
export function daylightHours(
  date: string,
  location?: { lat: number; lon: number },
): { sunriseHour: number; sunsetHour: number } {
  if (!location) return { sunriseHour: DAYLIGHT.sunriseHour, sunsetHour: DAYLIGHT.sunsetHour };
  const sr = sunEvent(date, location.lat, location.lon, true);
  const ss = sunEvent(date, location.lat, location.lon, false);
  if (sr == null || ss == null) {
    return { sunriseHour: DAYLIGHT.sunriseHour, sunsetHour: DAYLIGHT.sunsetHour };
  }
  return { sunriseHour: Math.round(sr), sunsetHour: Math.round(ss) };
}
