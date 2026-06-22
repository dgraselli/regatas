import { describe, it, expect } from 'vitest';
import { planCrossing, addHoursIso } from '@/lib/domain/routing';
import { buildRoute } from '@/lib/config/routes';
import type { HourlyPoint } from '@/lib/types/forecast';

const route = buildRoute(
  { name: 'Mi amarra', lat: -34.839876, lon: -57.923381 },
  { name: 'Colonia', lat: -34.47, lon: -57.84 },
);

function forecast(dir: number, wind: number): HourlyPoint[] {
  return Array.from({ length: 80 }, (_, i) => ({
    time: `2026-06-18T${String(i % 24).padStart(2, '0')}:00`,
    windKt: wind,
    gustKt: wind + 4,
    windDir: dir,
    precipMm: 0,
    tempC: 15,
  }));
}

describe('routing', () => {
  it('addHoursIso preserva la hora de pared', () => {
    expect(addHoursIso('2026-06-18T10:00', 5)).toBe('2026-06-18T15:00');
    expect(addHoursIso('2026-06-18T22:00', 5)).toBe('2026-06-19T03:00');
  });

  it('produce un plan con candidatos y un mejor', () => {
    const plan = planCrossing(route, forecast(90, 14));
    expect(plan.ranked.length).toBeGreaterThan(0);
    expect(plan.best).not.toBeNull();
    expect(plan.best!.legs.length).toBeGreaterThan(0);
  });

  it('el cruce directo tiene un rumbo único y completa la distancia', () => {
    const plan = planCrossing(route, forecast(90, 14));
    const best = plan.best!;
    expect(best.completes).toBe(true);
    expect(best.course).toBeGreaterThanOrEqual(0);
    expect(best.course).toBeLessThan(360);
    // El último tramo acumula ~la distancia total del cruce.
    const last = best.legs[best.legs.length - 1];
    expect(last.cumulativeNm).toBeGreaterThanOrEqual(best.distanceNm - 0.5);
    // Cada tramo dura como mucho 1 h.
    expect(best.legs.every((l) => l.hours <= 1)).toBe(true);
  });

  it('ruta larga de proa no completa el cruce en el horizonte', () => {
    // ~210 NM rumbo norte; viento del N (de proa) deja al barco bordejeando lento.
    const longRoute = buildRoute(
      { name: 'Sur', lat: -36.5, lon: -57.0 },
      { name: 'Norte', lat: -33.0, lon: -57.0 },
    );
    const plan = planCrossing(longRoute, forecast(0, 6));
    expect(plan.best!.completes).toBe(false);
    expect(plan.best!.warnings.join(' ')).toMatch(/no completa/i);
  });

  it('viento de través favorable da ETA razonable (~3-6 h)', () => {
    const plan = planCrossing(route, forecast(90, 14));
    expect(plan.best!.totalHours).toBeGreaterThan(2);
    expect(plan.best!.totalHours).toBeLessThan(8);
  });

  it('viento fuerte genera advertencia de rizos', () => {
    const plan = planCrossing(route, forecast(90, 32));
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).toMatch(/rizos/i);
  });

  it('rumbo en zona muerta penaliza el costo frente a través', () => {
    // La ruta apunta aprox. al N/NE; viento del N (0°) deja el rumbo casi de proa.
    const upwind = planCrossing(route, forecast(10, 14));
    const reach = planCrossing(route, forecast(100, 14));
    expect(upwind.best!.totalHours).toBeGreaterThan(reach.best!.totalHours);
  });
});
