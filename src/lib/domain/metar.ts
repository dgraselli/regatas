/**
 * Parser/normalizador de observaciones METAR (dominio puro, sin red).
 *
 * METAR es el reporte meteorológico horario de los aeropuertos: visibilidad,
 * fenómeno presente (niebla FG, neblina BR…), temperatura y punto de rocío
 * MEDIDOS. Es la mejor observación real de visibilidad para contrastar el flojo
 * pronóstico de niebla del Plata (ver PLAN). Acá solo se normaliza/clasifica; la
 * obtención (borde de red) y el catálogo de estaciones viven aparte.
 *
 * La entrada tiene la forma del JSON de aviationweather.gov (NOAA), donde la
 * visibilidad viene en millas terrestres (SM) como número o texto ("6+", "1 1/2",
 * "M1/4"). El punto de rocío cercano a la temperatura + viento flojo es el mejor
 * indicador de niebla, así que se expone el spread T−Td.
 */

/** Observación METAR cruda (subset del JSON de aviationweather.gov). */
export interface MetarRaw {
  icaoId: string;
  name?: string;
  reportTime?: string;
  obsTime?: number; // epoch segundos
  temp?: number | null;
  dewp?: number | null;
  wspd?: number | null; // nudos
  /** Visibilidad en millas terrestres (SM): número o texto ("6+", "1 1/2", "M1/4"). */
  visib?: number | string | null;
  /** Fenómeno presente ("FG", "BR", "-RA BR"…), si hay. */
  wxString?: string | null;
  /** Categoría de vuelo ya clasificada: VFR / MVFR / IFR / LIFR. */
  fltCat?: string | null;
}

/** Observación normalizada al dominio (unidades métricas). */
export interface MetarObservation {
  station: string;
  name?: string;
  time?: string;
  /** Visibilidad en metros, si hay dato. */
  visibilityM?: number;
  tempC?: number;
  dewpointC?: number;
  /** Spread T−Td (°C): cerca de 0 = aire saturado, riesgo de niebla. */
  spreadC?: number;
  windKt?: number;
  /** Niebla observada (FG y variantes en el fenómeno presente). */
  fog: boolean;
  /** Neblina/bruma/humo observados (BR/HZ/FU). */
  mist: boolean;
  fltCat?: string;
}

const SM_TO_M = 1609.344;

/**
 * Convierte la visibilidad METAR (millas terrestres, número o texto) a metros.
 * Soporta "6+" (6 o más), "10", "1 1/2", "1/2" y "M1/4" (menos de 1/4).
 */
export function parseVisibilityMeters(
  visib: number | string | null | undefined,
): number | undefined {
  if (visib == null) return undefined;
  if (typeof visib === 'number') {
    return Number.isFinite(visib) ? Math.round(visib * SM_TO_M) : undefined;
  }
  let s = visib.trim().toUpperCase();
  if (!s) return undefined;
  s = s.replace(/SM$/, '').trim();
  if (s.endsWith('+')) s = s.slice(0, -1).trim(); // "6+" = 6 o más
  if (s.startsWith('M')) s = s.slice(1).trim(); // "M1/4" = menos de 1/4

  const value = (str: string): number | null => {
    if (str.includes('/')) {
      const [a, b] = str.split('/').map(Number);
      return b ? a / b : null;
    }
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  };

  const parts = s.split(/\s+/);
  let sm: number | null;
  if (parts.length === 2) {
    const whole = Number(parts[0]);
    const frac = value(parts[1]);
    sm = Number.isFinite(whole) && frac != null ? whole + frac : null;
  } else {
    sm = value(parts[0]);
  }
  return sm == null ? undefined : Math.round(sm * SM_TO_M);
}

/** Normaliza una observación METAR cruda al dominio. */
export function normalizeMetar(raw: MetarRaw): MetarObservation {
  const tempC = raw.temp ?? undefined;
  const dewpointC = raw.dewp ?? undefined;
  const spreadC =
    tempC != null && dewpointC != null ? Math.round((tempC - dewpointC) * 10) / 10 : undefined;
  const wx = (raw.wxString ?? '').toUpperCase();
  const fog = /(^|\s|MI|BC|PR|FZ|VC)FG(\s|$)/.test(wx) || /\bFG\b/.test(wx);
  const mist = /\bBR\b/.test(wx) || /\bHZ\b/.test(wx) || /\bFU\b/.test(wx);
  const time =
    raw.reportTime ?? (raw.obsTime ? new Date(raw.obsTime * 1000).toISOString() : undefined);
  return {
    station: raw.icaoId,
    name: raw.name,
    time,
    visibilityM: parseVisibilityMeters(raw.visib),
    tempC,
    dewpointC,
    spreadC,
    windKt: raw.wspd ?? undefined,
    fog,
    mist,
    fltCat: raw.fltCat ?? undefined,
  };
}

/** Clasificación de visibilidad observada, alineada con los umbrales de niebla del scoring. */
export type VisibilityLevel = 'niebla' | 'neblina' | 'despejado' | 'sin-dato';

/**
 * Nivel de visibilidad observado según los umbrales de niebla del usuario
 * (`fogRedM` = niebla cerrada, `fogYellowM` = neblina). Manda la VISIBILIDAD
 * horizontal medida: la niebla superficial (MIFG/BCFG) suele reportarse con
 * visibilidad alta y NO obstruye la navegación, así que no debe marcar niebla.
 * El fenómeno FG solo se usa de respaldo cuando falta el dato numérico.
 */
export function metarVisibilityLevel(
  obs: MetarObservation,
  thresholds: { fogYellowM: number; fogRedM: number },
): VisibilityLevel {
  if (obs.visibilityM != null) {
    if (obs.visibilityM <= thresholds.fogRedM) return 'niebla';
    if (obs.visibilityM <= thresholds.fogYellowM) return 'neblina';
    return 'despejado';
  }
  if (obs.fog) return 'niebla';
  if (obs.mist) return 'neblina';
  return 'sin-dato';
}
