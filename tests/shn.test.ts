import { describe, it, expect } from 'vitest';
import { parseShnCsv } from '@/lib/domain/shn';

const CSV = [
  'Fecha y hora;Martín García;San Fernando;Buenos Aires;Pilote Norden',
  '24/09/2026 09:45;S/D;0.34;0.27;0.28',
  '24/09/2026 08:45;S/D;0.36;S/D;0.32',
  '23/09/2026 23:45;1.33;-0.04;-0.10;0.02',
  '',
].join('\r\n');

describe('shn — alturas horarias', () => {
  it('devuelve la serie de la estación en orden cronológico y hora local naive', () => {
    expect(parseShnCsv(CSV, 'San Fernando')).toEqual([
      { time: '2026-09-23T23:45', heightM: -0.04 },
      { time: '2026-09-24T08:45', heightM: 0.36 },
      { time: '2026-09-24T09:45', heightM: 0.34 },
    ]);
  });

  it('saltea "S/D" (sin dato)', () => {
    expect(parseShnCsv(CSV, 'Buenos Aires').map((o) => o.time)).toEqual([
      '2026-09-23T23:45',
      '2026-09-24T09:45',
    ]);
  });

  it('encuentra la columna aunque cambien tildes o mayúsculas', () => {
    expect(parseShnCsv(CSV, 'martin garcia')).toEqual([{ time: '2026-09-23T23:45', heightM: 1.33 }]);
  });

  it('estación ausente o CSV vacío → []', () => {
    expect(parseShnCsv(CSV, 'Atalaya')).toEqual([]);
    expect(parseShnCsv('', 'San Fernando')).toEqual([]);
    expect(parseShnCsv('<html>error</html>', 'San Fernando')).toEqual([]);
  });
});
