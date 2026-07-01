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
