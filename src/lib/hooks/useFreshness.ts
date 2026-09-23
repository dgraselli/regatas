'use client';

import { useEffect, useState } from 'react';
import { minutesSince } from '@/lib/format';
import { TIMEZONE } from '@/lib/profile/defaults';

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

/**
 * Se redondea (no se trunca): con `floor`, un dato de 1 h 58 min se anunciaba
 * como "hace 1 h", subestimando el atraso hasta en 59 minutos. Para un aviso de
 * dato viejo, quedarse corto es el error que importa.
 */
function relativeLabel(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d > 1 ? 's' : ''}`;
}

/**
 * Calcula hace cuánto BAJAMOS un dato, a partir de su `fetchedAt`. Recalcula
 * cada minuto para que la antigüedad mostrada no se quede congelada. Devuelve
 * `null` si no hay timestamp válido.
 *
 * Es lo correcto para el pronóstico (que no envejece por estar cacheado, sino
 * por dejar de reflejar la última corrida). Para un dato medido —el nivel del
 * INA— lo que importa es cuándo lo midió el sensor: usar `useObservationAge`.
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

/**
 * Umbrales para una OBSERVACIÓN (no para el pronóstico). El mareógrafo mide a
 * HH:45 y el a5 del INA publica recién en el cron de la hora siguiente, así que
 * 1–2 h de atraso es lo normal y no merece aviso. Medido sobre 7 días de las
 * estaciones del Río de la Plata: p50 76 min, p90 ~140 min; las escalas de
 * Prefectura (Buenos Aires, San Fernando) tienen cola peor, con episodios de
 * hasta 13.7 h. A las 6 h ya no es demora de publicación: la estación está caída.
 */
export const OBSERVED_STALE_MS = 3 * 60 * 60 * 1000;
export const OBSERVED_SEVERE_MS = 6 * 60 * 60 * 1000;

export interface ObservationAge {
  /** Antigüedad relativa, ej. "hace 2 h". */
  agoLabel: string;
  ageMs: number;
  stale: boolean;
  severe: boolean;
}

/**
 * Antigüedad de un dato OBSERVADO, medida desde que el sensor lo midió.
 *
 * Es distinto de `useFreshness`, que mide desde que *nosotros* bajamos el dato
 * (`fetchedAt`) y por lo tanto siempre dice "recién": eso sirve para el
 * pronóstico —que no envejece por estar guardado— pero esconde el atraso propio
 * del nivel observado, que es de 1 a 2 h contra el reloj del navegante.
 *
 * `localIso` es el timestamp naive del INA ('YYYY-MM-DDTHH:mm' en `TIMEZONE`,
 * como lo arma `fetchWaterLevel`).
 */
export function useObservationAge(
  localIso?: string,
  timezone: string = TIMEZONE,
): ObservationAge | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!localIso) return null;
  const min = minutesSince(localIso, timezone, new Date(now));
  if (min == null) return null;

  const ageMs = Math.max(0, min * 60_000);
  return {
    agoLabel: relativeLabel(ageMs),
    ageMs,
    stale: ageMs > OBSERVED_STALE_MS,
    severe: ageMs > OBSERVED_SEVERE_MS,
  };
}
