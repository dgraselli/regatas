import type { PointOfSail } from '@/lib/types/crossing';

/**
 * Clasifica el rumbo de navegación según el TWA (ángulo real al viento, 0..180).
 * @param twa ángulo al viento en grados
 * @param noGoAngle ángulo de la zona muerta (por debajo no se puede navegar de ceñida)
 */
export function pointOfSail(twa: number, noGoAngle: number): PointOfSail {
  if (twa < noGoAngle) return 'en irons';
  if (twa < 60) return 'ceñida';
  if (twa < 100) return 'través';
  if (twa < 150) return 'aleta';
  return 'popa';
}

/** Etiqueta legible (con descripción) para mostrar en la UI. */
export function pointOfSailLabel(p: PointOfSail): string {
  switch (p) {
    case 'en irons':
      return 'Zona muerta (hay que ceñir/virar)';
    case 'ceñida':
      return 'Ceñida';
    case 'través':
      return 'Través';
    case 'aleta':
      return 'Aleta';
    case 'popa':
      return 'Popa';
  }
}

/**
 * Etiqueta para embarcaciones a motor: no hay amura ni ceñida, sino el sector
 * del que llega el viento/mar respecto del rumbo (proa/través/aleta/popa).
 */
export function seaSectorLabel(p: PointOfSail): string {
  switch (p) {
    case 'en irons':
    case 'ceñida':
      return 'Mar de proa';
    case 'través':
      return 'Mar de través';
    case 'aleta':
      return 'Mar de aleta';
    case 'popa':
      return 'Mar de popa';
  }
}

/** Sector del que llega la ola respecto del rumbo del barco. */
export type WaveSector = 'proa' | 'través' | 'aleta' | 'popa';

/**
 * Clasifica de qué sector llega la ola según el ángulo relativo al rumbo
 * (0 = de proa, 180 = de popa). Distinto del rumbo al viento: acá interesa el
 * efecto sobre el barco (cabeceo de proa, balanceo de través).
 * @param relAngle ángulo entre el rumbo y la dirección de procedencia de la ola (0..180).
 */
export function waveSector(relAngle: number): WaveSector {
  if (relAngle < 45) return 'proa';
  if (relAngle < 100) return 'través';
  if (relAngle < 145) return 'aleta';
  return 'popa';
}

/**
 * Cuánto "pesa" la ola sobre el barco según de qué sector llega, para modular el
 * semáforo del cruce: de proa/través pega de lleno (cabeceo/balanceo); de aleta y
 * sobre todo de popa es más cómoda, así que la misma altura molesta menos.
 * Se usa como `alturaEfectiva = Hs × factor` contra los umbrales de olas.
 */
export function waveSeverityFactor(s: WaveSector): number {
  switch (s) {
    case 'proa':
      return 1;
    case 'través':
      return 1;
    case 'aleta':
      return 0.75;
    case 'popa':
      return 0.6;
  }
}

/** Etiqueta legible del sector de la ola (con el efecto sobre el barco). */
export function waveSectorLabel(s: WaveSector): string {
  switch (s) {
    case 'proa':
      return 'Mar de proa (cabeceo)';
    case 'través':
      return 'Mar de través (balanceo)';
    case 'aleta':
      return 'Mar de aleta';
    case 'popa':
      return 'Mar de popa';
  }
}
