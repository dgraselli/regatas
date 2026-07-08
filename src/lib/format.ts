/** Utilidades de formato para la UI (en español). */

const DIRS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO',
];

/** Grados (de dónde viene el viento) → punto cardinal. */
export function compass(deg: number): string {
  const i = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return DIRS[i];
}

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'YYYY-MM-DD' → 'Mié 18 jun'. Sin dependencia de zona horaria. */
export function formatDate(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
  return `${DOW[dow]} ${d} ${MON[m]}`;
}

/** 'YYYY-MM-DD' → 'Mié 18' (sin mes). Compacto para las tarjetas del panel. */
export function formatDateShort(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
  return `${DOW[dow]} ${d}`;
}

/** 'YYYY-MM-DDTHH:mm' → 'HH:mm'. Tolera valores ausentes/ inválidos. */
export function formatHour(iso: string): string {
  return typeof iso === 'string' ? iso.slice(11, 16) : '';
}

/** Visibilidad legible: metros por debajo de 1 km, km por encima. */
export function formatVisibility(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/**
 * Fecha de hoy ('YYYY-MM-DD') en la zona horaria dada. Sirve para descartar
 * días ya pasados del caché persistido (que puede tener un pronóstico viejo).
 */
export function todayInTz(timezone: string, now: Date = new Date()): string {
  // en-CA da el formato 'YYYY-MM-DD'.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Horas decimales → 'Xh YYmin'. */
export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
