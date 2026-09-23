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

/**
 * Fecha y hora actuales ('YYYY-MM-DDTHH:mm') en la zona horaria dada, el mismo
 * formato de los puntos horarios del pronóstico. Sirve para marcar la hora
 * actual en los gráficos del día de hoy.
 */
export function nowInTz(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** 'hace X min'/'hace X h' a partir de un timestamp ISO. Sin dato o futuro → 'ahora'. */
export function ageLabel(iso?: string): string {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 0) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
}

/** Horas decimales → 'Xh YYmin'. */
export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Minutos transcurridos entre un timestamp local "naive" ('YYYY-MM-DDTHH:mm',
 * sin zona) y el momento actual. Los timestamps del INA y del pronóstico vienen
 * así, y `new Date(iso)` los interpretaría en la zona del *dispositivo*: al
 * comparar contra `nowInTz` —el ahora expresado en el mismo formato y zona— el
 * desfasaje se cancela y la cuenta sale bien aunque el celular esté en otro huso.
 * Puede dar negativo si el timestamp es futuro. Devuelve null si es inválido.
 */
export function minutesSince(
  localIso: string,
  timezone: string,
  now: Date = new Date(),
): number | null {
  // Ambos se parsean como UTC: el offset real es el mismo para los dos y se anula.
  const then = parseLocalIso(localIso);
  const ahora = parseLocalIso(nowInTz(timezone, now));
  if (then == null || ahora == null) return null;
  return Math.round((ahora - then) / 60_000);
}

/**
 * Un timestamp local naive ('YYYY-MM-DDTHH:mm') a milisegundos, tratándolo como
 * si fuera UTC. El valor absoluto no significa nada: sirve para restar dos
 * timestamps de la MISMA zona, donde el desfasaje se cancela. `Date.parse` es
 * demasiado permisivo (acepta basura y devuelve fechas absurdas), así que se
 * exige la forma exacta antes de parsear. Devuelve null si no la cumple.
 */
export function parseLocalIso(localIso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(localIso)) return null;
  const ms = Date.parse(`${localIso.slice(0, 16)}:00Z`);
  return Number.isNaN(ms) ? null : ms;
}
