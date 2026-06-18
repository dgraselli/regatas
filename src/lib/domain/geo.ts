/** Utilidades geográficas puras: distancia, rumbo y ángulo al viento. */

const R_NM = 3440.065; // radio terrestre en millas náuticas

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Distancia great-circle entre dos puntos, en millas náuticas. */
export function haversineNm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumbo inicial (forward azimuth) de A a B, en grados verdaderos 0..360. */
export function initialBearing(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const dLon = toRad(bLon - aLon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Diferencia angular mínima entre dos rumbos (0..180). */
export function angularDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Ángulo real al viento (TWA), normalizado a 0..180.
 * Es la separación entre el rumbo del barco y la dirección DESDE la que viene
 * el viento: 0 = viento de proa (headwind), 180 = viento de popa.
 */
export function trueWindAngle(boatHeading: number, windFrom: number): number {
  return angularDiff(boatHeading, windFrom);
}

/** ¿Está 'dir' dentro del sector [from, to] (grados, puede cruzar el 0)? */
export function inSector(dir: number, sector: [number, number]): boolean {
  const d = ((dir % 360) + 360) % 360;
  const [from, to] = sector;
  if (from <= to) return d >= from && d <= to;
  // sector que cruza el norte (p.ej. 292..22)
  return d >= from || d <= to;
}
