import { describe, it, expect } from 'vitest';
import { detectSurge } from '@/lib/domain/surge';
import type { HourlyPoint } from '@/lib/types/forecast';

function hours(
  n: number,
  opts: { wind: number; dir: number; seaTrend?: number },
  startHour = 0,
): HourlyPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    time: `2026-06-18T${String((startHour + i) % 24).padStart(2, '0')}:00`,
    windKt: opts.wind,
    gustKt: opts.wind + 5,
    windDir: opts.dir,
    precipMm: 0,
    tempC: 14,
    seaLevelM: opts.seaTrend != null ? i * opts.seaTrend : undefined,
  }));
}

describe('surge', () => {
  it('detecta sudestada con viento SE sostenido', () => {
    const alerts = detectSurge(hours(10, { wind: 22, dir: 135 }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('sudestada');
    expect(alerts[0].durationH).toBe(10);
  });

  it('detecta bajante con viento NW sostenido', () => {
    const alerts = detectSurge(hours(8, { wind: 20, dir: 315 }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('bajante');
  });

  it('no dispara si el viento es flojo', () => {
    expect(detectSurge(hours(12, { wind: 10, dir: 135 }))).toHaveLength(0);
  });

  it('no dispara si dura poco', () => {
    expect(detectSurge(hours(4, { wind: 25, dir: 135 }))).toHaveLength(0);
  });

  it('no dispara con viento de otro sector (W)', () => {
    expect(detectSurge(hours(12, { wind: 25, dir: 270 }))).toHaveLength(0);
  });

  it('sube la confianza si el nivel del mar corrobora la sudestada', () => {
    const alerts = detectSurge(hours(10, { wind: 24, dir: 135, seaTrend: 0.05 }));
    expect(alerts[0].confidence).toBeGreaterThan(0.8);
  });

  it('baja la confianza si el nivel contradice', () => {
    const alerts = detectSurge(hours(10, { wind: 24, dir: 135, seaTrend: -0.05 }));
    expect(alerts[0].confidence).toBeLessThan(0.5);
  });
});
