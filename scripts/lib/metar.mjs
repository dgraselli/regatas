/**
 * Espejo en Node (ops, no parte de la app) del dominio METAR de
 * src/lib/domain/metar.ts, más el catálogo de estaciones y el borde de red.
 * Sirve para validar el pronóstico de niebla contra la observación real de los
 * aeropuertos (aviationweather.gov / NOAA), que da hasta 7 días de historia.
 */

const SM_TO_M = 1609.344;

export function parseVisibilityMeters(visib) {
  if (visib == null) return undefined;
  if (typeof visib === 'number') return Number.isFinite(visib) ? Math.round(visib * SM_TO_M) : undefined;
  let s = String(visib).trim().toUpperCase();
  if (!s) return undefined;
  s = s.replace(/SM$/, '').trim();
  if (s.endsWith('+')) s = s.slice(0, -1).trim();
  if (s.startsWith('M')) s = s.slice(1).trim();
  const value = (str) => {
    if (str.includes('/')) { const [a, b] = str.split('/').map(Number); return b ? a / b : null; }
    const n = Number(str); return Number.isFinite(n) ? n : null;
  };
  const parts = s.split(/\s+/);
  let sm;
  if (parts.length === 2) {
    const whole = Number(parts[0]); const frac = value(parts[1]);
    sm = Number.isFinite(whole) && frac != null ? whole + frac : null;
  } else sm = value(parts[0]);
  return sm == null ? undefined : Math.round(sm * SM_TO_M);
}

export function normalizeMetar(raw) {
  const tempC = raw.temp ?? undefined;
  const dewpointC = raw.dewp ?? undefined;
  const spreadC = tempC != null && dewpointC != null ? Math.round((tempC - dewpointC) * 10) / 10 : undefined;
  const wx = (raw.wxString ?? '').toUpperCase();
  const fog = /(^|\s|MI|BC|PR|FZ|VC)FG(\s|$)/.test(wx) || /\bFG\b/.test(wx);
  const mist = /\bBR\b/.test(wx) || /\bHZ\b/.test(wx) || /\bFU\b/.test(wx);
  const time = raw.reportTime ?? (raw.obsTime ? new Date(raw.obsTime * 1000).toISOString() : undefined);
  return {
    station: raw.icaoId, name: raw.name, time,
    visibilityM: parseVisibilityMeters(raw.visib),
    tempC, dewpointC, spreadC, windKt: raw.wspd ?? undefined, fog, mist,
    fltCat: raw.fltCat ?? undefined, wx,
  };
}

export function metarVisibilityLevel(obs, { fogYellowM, fogRedM }) {
  if (obs.visibilityM != null) {
    if (obs.visibilityM <= fogRedM) return 'niebla';
    if (obs.visibilityM <= fogYellowM) return 'neblina';
    return 'despejado';
  }
  if (obs.fog) return 'niebla';
  if (obs.mist) return 'neblina';
  return 'sin-dato';
}

/** Aeropuertos con METAR del Río de la Plata (ICAO, lat, lon, nombre). */
export const METAR_STATIONS = [
  { icao: 'SABE', lat: -34.559, lon: -58.416, name: 'Aeroparque (BA)' },
  { icao: 'SAEZ', lat: -34.822, lon: -58.536, name: 'Ezeiza' },
  { icao: 'SADF', lat: -34.453, lon: -58.589, name: 'San Fernando' },
  { icao: 'SADP', lat: -34.61, lon: -58.612, name: 'El Palomar' },
  { icao: 'SADL', lat: -34.972, lon: -57.895, name: 'La Plata' },
  { icao: 'SUMU', lat: -34.838, lon: -56.008, name: 'Carrasco (Montevideo)' },
  { icao: 'SUCA', lat: -34.456, lon: -57.771, name: 'Colonia' },
  { icao: 'SAAG', lat: -33.007, lon: -58.613, name: 'Gualeguaychú' },
];

const hav = (aLat, aLon, bLat, bLon) => {
  const R = 6371, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

/** Estación METAR más cercana a un punto (con la distancia en km). */
export function nearestMetarStation(lat, lon) {
  let best = METAR_STATIONS[0], bestD = Infinity;
  for (const s of METAR_STATIONS) {
    const d = hav(lat, lon, s.lat, s.lon);
    if (d < bestD) { bestD = d; best = s; }
  }
  return { ...best, distanceKm: Math.round(bestD) };
}

/** Trae hasta `hours` horas de METAR (crudos) de varias estaciones en una llamada. */
export async function fetchMetarHistory(icaoIds, hours = 168) {
  const ids = icaoIds.join(',');
  const url = `https://aviationweather.gov/api/data/metar?ids=${ids}&format=json&hours=${hours}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`METAR HTTP ${res.status}`);
  return res.json();
}

/** Fecha local (RdlP, UTC−3) 'YYYY-MM-DD' de un ISO UTC. */
export function localDate(iso) {
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}
