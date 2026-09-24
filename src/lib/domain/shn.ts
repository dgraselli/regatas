/**
 * Alturas horarias del SHN (Servicio de Hidrografía Naval), export CSV de
 * https://www.hidro.gov.ar/oceanografia/alturashorarias.asp.
 *
 * Son los MISMOS mareógrafos que después republica el INA, pero el SHN los
 * publica minutos después de medir (a los :45) y el INA con 1 a 2 h de atraso.
 *
 * Formato (separador `;`, filas de la más nueva a la más vieja, ~12 días):
 *   Fecha y hora;Martín García;San Fernando;Buenos Aires;...
 *   24/09/2026 09:45;S/D;0.34;0.27;...
 * La hora ya es la oficial argentina, y "S/D" es "sin dato".
 */

export interface ShnObservation {
  /** ISO naive en hora argentina: 'YYYY-MM-DDTHH:mm'. */
  time: string;
  heightM: number;
}

/** Sin tildes ni mayúsculas, para no depender de cómo venga codificado el encabezado. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/;

/**
 * Serie de una estación, en orden cronológico. Devuelve `[]` si la estación no
 * figura en el encabezado (el SHN cambió el CSV): el llamador cae al INA.
 */
export function parseShnCsv(csv: string, station: string): ShnObservation[] {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const col = lines[0].split(';').map(norm).indexOf(norm(station));
  if (col < 1) return [];

  const out: ShnObservation[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(';');
    const m = DATE_RE.exec(cells[0]?.trim() ?? '');
    const raw = cells[col]?.trim().replace(',', '.');
    if (!m || !raw || !/^-?\d+(\.\d+)?$/.test(raw)) continue;
    const [, dd, mm, yyyy, hh, mi] = m;
    out.push({ time: `${yyyy}-${mm}-${dd}T${hh}:${mi}`, heightM: Number(raw) });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
