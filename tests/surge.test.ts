import { describe, it, expect } from 'vitest';
import { detectSurge, tidalFilter, levelToAnomalyM } from '@/lib/domain/surge';
import type { HourlyPoint } from '@/lib/types/forecast';

const iso = (i: number) => {
  const d = new Date(Date.UTC(2026, 5, 18) + i * 3_600_000);
  return d.toISOString().slice(0, 16);
};

/** Serie horaria de viento constante, opcionalmente con nivel del mar por hora. */
function hours(
  n: number,
  opts: { wind: number; dir: number; sea?: (i: number) => number },
): HourlyPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    time: iso(i),
    windKt: opts.wind,
    gustKt: opts.wind + 5,
    windDir: opts.dir,
    precipMm: 0,
    tempC: 14,
    seaLevelM: opts.sea ? opts.sea(i) : undefined,
  }));
}

/** Marea astronómica semidiurna (12.42 h) de ±0.4 m alrededor de `mean(i)`. */
const tide = (mean: (i: number) => number) => (i: number) =>
  mean(i) + 0.4 * Math.sin((2 * Math.PI * i) / 12.42);

describe('tidalFilter', () => {
  it('cancela la marea astronómica y deja el nivel medio', () => {
    const f = tidalFilter(Array.from({ length: 72 }, (_, i) => tide(() => 0.2)(i)));
    for (const v of f.slice(12, 60)) expect(v!).toBeCloseTo(0.2, 1);
  });

  it('en los bordes usa la ventana de un solo lado si alcanza un ciclo', () => {
    const f = tidalFilter(Array.from({ length: 48 }, () => 0.3));
    expect(f[0]).toBeCloseTo(0.3);
    expect(f[47]).toBeCloseTo(0.3);
  });

  it('devuelve null si faltan muestras', () => {
    const f = tidalFilter([0.1, undefined, 0.2]);
    expect(f.every((v) => v == null)).toBe(true);
  });
});

describe('surge por nivel del mar', () => {
  it('agua alta aunque el viento local sea flojo (el caso que se perdía)', () => {
    // Nivel medio que sube a +0.7 m durante un día, con viento de 8 kt: la
    // regla vieja por viento no veía nada de esto.
    const mean = (i: number) => (i >= 36 && i < 60 ? 0.7 : 0.15);
    const alerts = detectSurge(hours(96, { wind: 8, dir: 90, sea: tide(mean) }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('sudestada');
    expect(alerts[0].source).toBe('nivel');
    expect(alerts[0].anomalyM).toBeGreaterThan(0.4);
    expect(alerts[0].message).toMatch(/sobre lo normal/);
  });

  it('agua baja', () => {
    const mean = (i: number) => (i >= 36 && i < 60 ? -0.3 : 0.15);
    const alerts = detectSurge(hours(96, { wind: 15, dir: 330, sea: tide(mean) }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('bajante');
    expect(alerts[0].anomalyM!).toBeLessThan(0);
  });

  it('no alerta con marea astronómica sola, por grande que sea', () => {
    const alerts = detectSurge(hours(96, { wind: 25, dir: 135, sea: (i) => 0.15 + 0.8 * Math.sin((2 * Math.PI * i) / 12.42) }));
    expect(alerts).toHaveLength(0);
  });

  it('con nivel del mar manda el nivel, no el viento', () => {
    // Viento de sudestada fuerte pero el agua no se mueve: no hay alerta.
    expect(detectSurge(hours(48, { wind: 25, dir: 170, sea: () => 0.15 }))).toHaveLength(0);
  });

  it('la severidad crece con el pico', () => {
    const at = (m: number) =>
      detectSurge(hours(96, { wind: 10, dir: 170, sea: tide((i) => (i >= 36 && i < 60 ? m : 0.15)) }))[0];
    expect(at(0.5).severity).toBe(1);
    expect(at(0.65).severity).toBe(2);
    expect(at(0.85).severity).toBe(3);
  });

  it('convierte a la escala del mareógrafo', () => {
    expect(levelToAnomalyM(0.6)).toBeCloseTo(0.556, 2);
  });
});

describe('surge por viento (respaldo sin nivel)', () => {
  it('detecta sudestada con viento del S-SSE sostenido', () => {
    const alerts = detectSurge(hours(10, { wind: 14, dir: 170 }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('sudestada');
    expect(alerts[0].source).toBe('viento');
    expect(alerts[0].durationH).toBe(10);
    expect(alerts[0].confidence).toBeLessThan(0.6);
  });

  it('detecta bajante con viento NW sostenido', () => {
    const alerts = detectSurge(hours(8, { wind: 12, dir: 315 }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('bajante');
  });

  it('no dispara si el viento es flojo', () => {
    expect(detectSurge(hours(12, { wind: 8, dir: 170 }))).toHaveLength(0);
  });

  it('no dispara si dura poco', () => {
    expect(detectSurge(hours(4, { wind: 25, dir: 170 }))).toHaveLength(0);
  });

  it('no dispara con viento de otro sector (E)', () => {
    expect(detectSurge(hours(12, { wind: 25, dir: 90 }))).toHaveLength(0);
  });
});
