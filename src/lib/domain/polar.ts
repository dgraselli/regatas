import type { BoatPolar } from '@/lib/types/config';

/** Interpolación lineal en un arreglo ordenado; devuelve el índice y la fracción. */
function locate(points: number[], value: number): { i: number; frac: number } {
  if (value <= points[0]) return { i: 0, frac: 0 };
  const last = points.length - 1;
  if (value >= points[last]) return { i: last - 1, frac: 1 };
  let i = 0;
  while (i < last && points[i + 1] < value) i++;
  const span = points[i + 1] - points[i];
  const frac = span === 0 ? 0 : (value - points[i]) / span;
  return { i, frac };
}

/**
 * Velocidad del barco (nudos) por interpolación bilineal en la polar,
 * dado el ángulo real al viento (TWA, 0..180) y la intensidad (TWS, nudos).
 */
export function boatSpeed(polar: BoatPolar, twa: number, tws: number): number {
  const twaAbs = Math.min(180, Math.max(0, Math.abs(twa)));
  const { i: ti, frac: tf } = locate(polar.twaPoints, twaAbs);
  const { i: wi, frac: wf } = locate(polar.twsPoints, tws);

  const s00 = polar.speeds[ti][wi];
  const s01 = polar.speeds[ti][wi + 1] ?? s00;
  const s10 = polar.speeds[ti + 1]?.[wi] ?? s00;
  const s11 = polar.speeds[ti + 1]?.[wi + 1] ?? s01;

  const top = s00 + (s01 - s00) * wf;
  const bottom = s10 + (s11 - s10) * wf;
  return top + (bottom - top) * tf;
}

/**
 * VMG hacia el destino (componente de la velocidad del barco en el rumbo deseado).
 * Útil para evaluar la eficiencia al ceñir.
 */
export function vmg(boatKt: number, twa: number): number {
  return boatKt * Math.cos((twa * Math.PI) / 180);
}
