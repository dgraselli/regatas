import { describe, it, expect } from 'vitest';
import {
  parseVisibilityMeters,
  normalizeMetar,
  metarVisibilityLevel,
} from '@/lib/domain/metar';
import { SCORING } from '@/lib/config/boat';

describe('metar — visibilidad', () => {
  it('convierte millas terrestres a metros', () => {
    expect(parseVisibilityMeters(10)).toBe(Math.round(10 * 1609.344));
    expect(parseVisibilityMeters('10')).toBe(Math.round(10 * 1609.344));
  });

  it('"6+" se interpreta como 6 millas (o más)', () => {
    expect(parseVisibilityMeters('6+')).toBe(Math.round(6 * 1609.344));
  });

  it('fracciones: "1/2" y "1 1/2"', () => {
    expect(parseVisibilityMeters('1/2')).toBe(Math.round(0.5 * 1609.344));
    expect(parseVisibilityMeters('1 1/2')).toBe(Math.round(1.5 * 1609.344));
  });

  it('"M1/4" (menos de 1/4 de milla) ≈ 400 m', () => {
    expect(parseVisibilityMeters('M1/4')).toBe(Math.round(0.25 * 1609.344));
  });

  it('acepta el sufijo SM y valores nulos', () => {
    expect(parseVisibilityMeters('2SM')).toBe(Math.round(2 * 1609.344));
    expect(parseVisibilityMeters(null)).toBeUndefined();
    expect(parseVisibilityMeters(undefined)).toBeUndefined();
    expect(parseVisibilityMeters('')).toBeUndefined();
  });
});

describe('metar — normalización', () => {
  it('normaliza una observación real (Aeroparque, día despejado)', () => {
    const obs = normalizeMetar({
      icaoId: 'SABE',
      name: 'Buenos Aires/Newbery',
      reportTime: '2026-07-02T16:00:00.000Z',
      temp: 8,
      dewp: -2,
      wspd: 5,
      visib: '6+',
      fltCat: 'VFR',
    });
    expect(obs.station).toBe('SABE');
    expect(obs.tempC).toBe(8);
    expect(obs.dewpointC).toBe(-2);
    expect(obs.spreadC).toBe(10); // 8 − (−2)
    expect(obs.visibilityM).toBeGreaterThan(9000);
    expect(obs.fog).toBe(false);
    expect(obs.mist).toBe(false);
  });

  it('detecta niebla (FG) y neblina (BR) en el fenómeno presente', () => {
    const fg = normalizeMetar({ icaoId: 'SADF', visib: '1/4', wxString: 'FG', temp: 12, dewp: 12 });
    expect(fg.fog).toBe(true);
    expect(fg.spreadC).toBe(0); // saturado

    const br = normalizeMetar({ icaoId: 'SADL', visib: '3', wxString: 'BR' });
    expect(br.fog).toBe(false);
    expect(br.mist).toBe(true);
  });
});

describe('metar — nivel de visibilidad', () => {
  const th = { fogYellowM: SCORING.fogYellowM, fogRedM: SCORING.fogRedM };

  it('manda la visibilidad: baja => niebla; media => neblina; alta => despejado', () => {
    expect(metarVisibilityLevel(normalizeMetar({ icaoId: 'X', visib: '1/4', wxString: 'FG' }), th)).toBe('niebla');
    expect(metarVisibilityLevel(normalizeMetar({ icaoId: 'X', visib: '2' }), th)).toBe('neblina');
    expect(metarVisibilityLevel(normalizeMetar({ icaoId: 'X', visib: '6+' }), th)).toBe('despejado');
  });

  it('niebla superficial (MIFG) con visibilidad alta NO marca niebla', () => {
    // Caso real de Aeroparque: MIFG con visib "6+" (niebla baja que no obstruye).
    const obs = normalizeMetar({ icaoId: 'SABE', visib: '6+', wxString: 'MIFG' });
    expect(obs.fog).toBe(true); // el fenómeno está…
    expect(metarVisibilityLevel(obs, th)).toBe('despejado'); // …pero la visibilidad manda
  });

  it('FG sin dato numérico de visibilidad => niebla (respaldo)', () => {
    expect(metarVisibilityLevel(normalizeMetar({ icaoId: 'X', wxString: 'FG' }), th)).toBe('niebla');
  });

  it('sin visibilidad ni fenómeno => sin-dato', () => {
    expect(metarVisibilityLevel(normalizeMetar({ icaoId: 'X' }), th)).toBe('sin-dato');
  });
});
