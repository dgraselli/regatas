import { describe, it, expect } from 'vitest';
import { detectFog } from '@/lib/domain/fog';
import { scoringFor } from '@/lib/config/boat';
import type { HourlyPoint } from '@/lib/types/forecast';

/** 24 horas con una visibilidad (m) dada por hora; `undefined` = sin dato. */
function hours(
  visByHour: (h: number) => number | undefined,
  date = '2026-06-18',
): HourlyPoint[] {
  return Array.from({ length: 24 }, (_, h) => ({
    time: `${date}T${String(h).padStart(2, '0')}:00`,
    windKt: 10,
    gustKt: 14,
    windDir: 270,
    precipMm: 0,
    tempC: 15,
    visibilityM: visByHour(h),
  }));
}

describe('detectFog', () => {
  it('niebla matinal => una alerta severa con su ventana', () => {
    const pts = hours((h) => (h >= 5 && h <= 8 ? 500 : 24000));
    const alerts = detectFog(pts);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe(2);
    expect(alerts[0].minVisibilityM).toBe(500);
    expect(alerts[0].durationH).toBe(4);
    expect(alerts[0].startsAt).toBe('2026-06-18T05:00');
    expect(alerts[0].endsAt).toBe('2026-06-18T08:00');
    expect(alerts[0].message).toMatch(/niebla/i);
  });

  it('visibilidad apenas reducida => severidad 1 (neblina)', () => {
    const alerts = detectFog(hours((h) => (h >= 6 && h <= 9 ? 3000 : 24000)));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe(1);
    expect(alerts[0].message).toMatch(/visibilidad reducida/i);
  });

  it('cielo despejado => sin alertas', () => {
    expect(detectFog(hours(() => 24000))).toHaveLength(0);
  });

  it('sin dato de visibilidad => sin alertas (no rompe)', () => {
    expect(detectFog(hours(() => undefined))).toHaveLength(0);
  });

  it('la sensibilidad sigue la tolerancia', () => {
    const pts = hours((h) => (h >= 5 && h <= 9 ? 1500 : 24000));
    expect(detectFog(pts, scoringFor('prudente'))[0].severity).toBe(2);
    expect(detectFog(pts, scoringFor('normal'))[0].severity).toBe(1);
  });

  it('dos ventanas separadas => dos alertas', () => {
    const pts = hours((h) => {
      if (h >= 5 && h <= 7) return 600;
      if (h >= 18 && h <= 20) return 3000;
      return 24000;
    });
    const alerts = detectFog(pts);
    expect(alerts).toHaveLength(2);
    expect(alerts[0].severity).toBe(2);
    expect(alerts[1].severity).toBe(1);
  });
});
