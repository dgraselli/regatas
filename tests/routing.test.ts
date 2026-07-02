import { describe, it, expect } from 'vitest';
import { planCrossing, addHoursIso } from '@/lib/domain/routing';
import { buildRoute } from '@/lib/config/routes';
import { scoringFor } from '@/lib/config/boat';
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

/** Forecast con datos de ola (altura/dirección/período) en todas las horas. */
function forecastWave(
  windDir: number,
  wind: number,
  waveM: number,
  waveDir: number,
  wavePeriodS = 6,
): HourlyPoint[] {
  return forecast(windDir, wind).map((p) => ({
    ...p,
    waveHeightM: waveM,
    waveDir,
    wavePeriodS,
  }));
}

/** Igual que `forecast` pero con timestamps que avanzan de verdad (necesario
 *  para los eventos de marea, que se solapan por hora real). */
function forecastSeq(dir: number, wind: number): HourlyPoint[] {
  const start = Date.UTC(2026, 5, 18, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: 80 }, (_, i) => {
    const d = new Date(start + i * 3600_000);
    const time = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(
      d.getUTCHours(),
    )}:00`;
    return { time, windKt: wind, gustKt: wind + 4, windDir: dir, precipMm: 0, tempC: 15 };
  });
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

  it('visibilidad baja agrega advertencia de niebla', () => {
    const foggy = forecast(90, 14).map((p) => ({ ...p, visibilityM: 600 }));
    const plan = planCrossing(route, foggy);
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).toMatch(/niebla/i);
  });

  it('buena visibilidad no agrega advertencia de niebla', () => {
    const clear = forecast(90, 14).map((p) => ({ ...p, visibilityM: 20000 }));
    const plan = planCrossing(route, clear);
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).not.toMatch(/niebla|visibilidad reducida/i);
  });

  it('sudestada en la ventana agrega advertencia de marea', () => {
    // Viento del SE (135°) sostenido y fuerte (≥18 kt) => sudestada.
    const plan = planCrossing(route, forecastSeq(135, 20));
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).toMatch(/sudestada|agua alta/i);
  });

  it('cada salida trae su semáforo; condiciones seguras => verde', () => {
    const plan = planCrossing(route, forecast(100, 14));
    expect(plan.best!.level).toBe('verde');
  });

  it('ráfagas peligrosas marcan las salidas como rojo', () => {
    const plan = planCrossing(route, forecast(90, 32)); // ráfagas 36 ≥ gustRed
    expect(plan.ranked.every((c) => c.level === 'rojo')).toBe(true);
    expect(plan.best!.level).toBe('rojo');
  });

  it('el mejor (best) evita las salidas rojas si hay opciones seguras', () => {
    // Mezcla: viento flojo/seguro las primeras horas, tormenta después.
    const mixed = forecast(100, 14).map((p, i) =>
      i >= 30 ? { ...p, windKt: 34, gustKt: 40 } : p,
    );
    const plan = planCrossing(route, mixed);
    expect(plan.best!.level).not.toBe('rojo');
  });

  it('el cruce respeta la tolerancia (prudente más estricto que normal)', () => {
    const fc = forecast(90, 26); // ráfagas ~30 kt
    const normal = planCrossing(route, fc, undefined, undefined, {
      thresholds: scoringFor('normal'),
    });
    const prudente = planCrossing(route, fc, undefined, undefined, {
      thresholds: scoringFor('prudente'),
    });
    expect(normal.ranked.some((c) => c.level === 'amarillo')).toBe(true);
    expect(prudente.ranked.every((c) => c.level === 'rojo')).toBe(true);
  });

  it('las salidas se devuelven en orden cronológico', () => {
    const plan = planCrossing(route, forecastSeq(100, 14));
    const times = plan.ranked.map((c) => c.departAt);
    const sorted = [...times].sort((a, b) => a.localeCompare(b));
    expect(times).toEqual(sorted);
  });

  it('rumbo en zona muerta penaliza el costo frente a través', () => {
    // La ruta apunta aprox. al N/NE; viento del N (0°) deja el rumbo casi de proa.
    const upwind = planCrossing(route, forecast(10, 14));
    const reach = planCrossing(route, forecast(100, 14));
    expect(upwind.best!.totalHours).toBeGreaterThan(reach.best!.totalHours);
  });

  it('a motor la velocidad de crucero es constante y no depende del ángulo al viento', () => {
    const opts = { propulsion: 'motor' as const, cruiseKt: 12 };
    // Viento de proa (0°) vs de través (100°): a motor el ETA debe ser el mismo.
    const upwind = planCrossing(route, forecast(0, 14), undefined, undefined, opts);
    const reach = planCrossing(route, forecast(100, 14), undefined, undefined, opts);
    expect(upwind.best!.completes).toBe(true);
    expect(upwind.best!.totalHours).toBeCloseTo(reach.best!.totalHours, 1);
    // Cada tramo navega a la velocidad de crucero.
    expect(upwind.best!.legs.every((l) => l.boatKt === 12)).toBe(true);
  });

  it('a motor no aparece la advertencia de rizos (concepto de vela)', () => {
    const opts = { propulsion: 'motor' as const, cruiseKt: 12 };
    const plan = planCrossing(route, forecast(90, 32), undefined, undefined, opts);
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).not.toMatch(/rizos/i);
    expect(allWarnings).toMatch(/mar formado/i);
  });

  // Ola respecto del rumbo (course ≈ 11° para esta ruta): de proa → cabeceo,
  // de través → balanceo. La ola afecta a vela y motor por igual.
  it('ola grande de proa => advertencia de cabeceo y semáforo rojo', () => {
    const plan = planCrossing(route, forecastWave(100, 12, 2.0, 11));
    const best = plan.best!;
    expect(best.legs[0].waveSector).toBe('proa');
    expect(best.level).toBe('rojo'); // 2.0 m ≥ waveRedM
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).toMatch(/mar de proa.*cabeceo/i);
  });

  it('ola moderada de través => advertencia de balanceo y semáforo amarillo', () => {
    const plan = planCrossing(route, forecastWave(100, 12, 1.2, 101));
    const best = plan.best!;
    expect(best.legs[0].waveSector).toBe('través');
    expect(best.level).toBe('amarillo'); // 1.2 m ≥ waveYellowM, < waveRedM
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).toMatch(/mar de través.*balanceo/i);
  });

  it('ola chica no agrega advertencia ni degrada por olas', () => {
    const plan = planCrossing(route, forecastWave(100, 12, 0.4, 11));
    expect(plan.best!.level).toBe('verde');
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).not.toMatch(/cabeceo|balanceo/i);
  });

  it('ola de popa grande no dispara cabeceo/balanceo', () => {
    // Ola desde ~191° (de popa respecto al rumbo ~11°).
    const plan = planCrossing(route, forecastWave(100, 12, 2.0, 191));
    expect(plan.best!.legs[0].waveSector).toBe('popa');
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).not.toMatch(/cabeceo|balanceo/i);
  });

  it('la dirección modula el umbral: 2.0 m de proa => rojo, de popa => no rojo', () => {
    // Misma altura (2.0 m), mismo viento seguro; solo cambia el sector de la ola.
    const proa = planCrossing(route, forecastWave(100, 12, 2.0, 11));
    const popa = planCrossing(route, forecastWave(100, 12, 2.0, 191));
    expect(proa.best!.legs[0].waveSector).toBe('proa');
    expect(popa.best!.legs[0].waveSector).toBe('popa');
    // De proa pega de lleno (factor 1) → rojo; de popa se atenúa (×0.6 = 1.2 m) → amarillo.
    expect(proa.best!.level).toBe('rojo');
    expect(popa.best!.level).toBe('amarillo');
  });

  it('la ola afecta también a motor (cabeceo)', () => {
    const opts = { propulsion: 'motor' as const, cruiseKt: 12 };
    const plan = planCrossing(route, forecastWave(100, 12, 2.0, 11), undefined, undefined, opts);
    expect(plan.best!.level).toBe('rojo');
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).toMatch(/cabeceo/i);
  });

  it('sin dato de ola el cruce no cambia (no rompe ni agrega olas)', () => {
    const plan = planCrossing(route, forecast(100, 14));
    expect(plan.best!.legs.every((l) => l.waveHeightM === undefined)).toBe(true);
    const allWarnings = plan.ranked.flatMap((c) => c.warnings).join(' ');
    expect(allWarnings).not.toMatch(/cabeceo|balanceo/i);
  });
});
