'use client';

import { useEffect, useState } from 'react';

/** A partir de acá, un pronóstico se considera potencialmente desactualizado. */
export const STALE_MS = 3 * 60 * 60 * 1000; // 3 h
/** A partir de acá, el dato es viejo en serio (aviso más fuerte). */
export const SEVERE_MS = 12 * 60 * 60 * 1000; // 12 h

export interface Freshness {
  /** Fecha/hora absoluta de la última recolección, ej. "23/6/26 14:05". */
  absLabel: string;
  /** Antigüedad relativa, ej. "hace 2 h". */
  agoLabel: string;
  ageMs: number;
  stale: boolean;
  severe: boolean;
}

function relativeLabel(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d > 1 ? 's' : ''}`;
}

/**
 * Calcula qué tan viejo es un dato a partir de su `fetchedAt`. Recalcula cada
 * minuto para que la antigüedad mostrada no se quede congelada. Devuelve `null`
 * si no hay timestamp válido.
 */
export function useFreshness(fetchedAt?: string): Freshness | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!fetchedAt) return null;
  const d = new Date(fetchedAt);
  const ts = d.getTime();
  if (Number.isNaN(ts)) return null;

  const ageMs = Math.max(0, now - ts);
  return {
    absLabel: d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
    agoLabel: relativeLabel(ageMs),
    ageMs,
    stale: ageMs > STALE_MS,
    severe: ageMs > SEVERE_MS,
  };
}
