import { describe, it, expect } from 'vitest';
import {
  correctedModel,
  projectMooringLevel,
  mooringAlerts,
  combineWaterAlerts,
  type LevelSample,
  type MooringProjection,
} from '@/lib/domain/mooringLevel';
import { scoreDays } from '@/lib/domain/scoring';
import { MOORING } from '@/lib/config/boat';
import type { SurgeAlert } from '@/lib/types/water';
import type { HourlyPoint } from '@/lib/types/forecast';

const iso = (i: number) => new Date(Date.UTC(2026, 10, 16) + i * 3_600_000).toISOString().slice(0, 13) + ':00';

const series = (n: number, level: (i: number) => number): LevelSample[] =>
  Array.from({ length: n }, (_, i) => ({ time: iso(i), m: level(i) }));

/** Marea semidiurna de ±a alrededor de `mean`. */
const tide = (mean: number, a = 0.4) => (i: number) => mean + a * Math.sin((2 * Math.PI * i) / 12.42);

describe('correctedModel', () => {
  it('corre el modelo lagH horas (el modelo adelanta la marea)', () => {
    const m = correctedModel(series(48, () => 0.3));
    expect(m.has(iso(0))).toBe(false);
    expect(m.get(iso(MOORING.lagH))).toBeCloseTo(0.3);
    expect(m.get(iso(47))).toBeCloseTo(0.3);
    // Lo que el corrimiento empuja más allá del pronóstico se recorta.
    expect(m.has(iso(48))).toBe(false);
  });

  it('amplifica la bajante por debajo del codo', () => {
    // Nivel medio −0.1: 0.2 + 2 × (−0.1 − 0.2) = −0.4
    const m = correctedModel(series(48, () => -0.1));
    expect(m.get(iso(24))).toBeCloseTo(MOORING.lowKneeM + MOORING.lowGain * (-0.1 - MOORING.lowKneeM));
  });

  it('no toca el nivel medio por encima del codo y agranda la marea', () => {
    const m = correctedModel(series(96, tide(0.4)));
    const vals = [...m.values()].slice(24, 72);
    const amp = (Math.max(...vals) - Math.min(...vals)) / 2;
    expect(amp).toBeCloseTo(0.4 * MOORING.tideAmp, 1);
    expect(vals.reduce((a, b) => a + b, 0) / vals.length).toBeCloseTo(0.4, 1);
  });
});

describe('projectMooringLevel', () => {
  const model = series(240, tide(0.3));
  const corrected = correctedModel(model);
  // Mediciones = modelo corregido + 0.9 m (cero del mareógrafo), las primeras 72 h.
  const obs = [...corrected.entries()].slice(0, 72).map(([time, m]) => ({ time, heightM: m + 0.9 }));

  it('ancla el modelo al cero del mareógrafo', () => {
    const p = projectMooringLevel(model, obs)!;
    expect(p.offsetM).toBeCloseTo(0.9);
    expect(p.calibHours).toBe(72);
    expect(p.points.at(-1)!.m).toBeCloseTo(corrected.get(p.points.at(-1)!.time)! + 0.9);
  });

  it('acepta mediciones a los :45 (redondea a la hora)', () => {
    // 'HH:00' → '(HH-1):45', que se redondea de vuelta a HH:00.
    const at45 = (t: string) => new Date(Date.parse(`${t}:00Z`) - 15 * 60_000).toISOString().slice(0, 16);
    const p = projectMooringLevel(model, obs.map((o) => ({ ...o, time: at45(o.time) })))!;
    expect(p.offsetM).toBeCloseTo(0.9);
  });

  it('sin horas suficientes que coincidan con el modelo no estima', () => {
    expect(projectMooringLevel(model, obs.slice(0, MOORING.minCalibHours - 1))).toBeNull();
    expect(projectMooringLevel([], obs)).toBeNull();
  });
});

describe('mooringAlerts', () => {
  // Dos días: el 1º con bajamar a 0.40 m, el 2º con pleamar a 2.10 m.
  const proj: MooringProjection = {
    offsetM: 0,
    calibHours: 72,
    points: [
      ...Array.from({ length: 24 }, (_, h) => ({ time: iso(h), m: h >= 4 && h <= 7 ? 0.4 : 1.2 })),
      ...Array.from({ length: 24 }, (_, h) => ({ time: iso(24 + h), m: h === 15 ? 2.1 : 1.2 })),
    ],
  };

  it('sin rango seguro no avisa', () => {
    expect(mooringAlerts(proj, {}, iso(0))).toEqual([]);
  });

  it('un aviso por día y tipo, con horas y nivel extremo', () => {
    const a = mooringAlerts(proj, { safeMinM: 0.6, safeMaxM: 2.0 }, iso(0));
    expect(a).toHaveLength(2);
    expect(a[0]).toMatchObject({ type: 'bajante', source: 'amarra', severity: 2, startsAt: iso(4), endsAt: iso(7) });
    expect(a[0].message).toContain('0.40 m');
    expect(a[0].message).toContain('0.60 m');
    expect(a[0].days).toEqual([{ date: iso(0).slice(0, 10), hours: 4, severity: 2 }]);
    expect(a[1]).toMatchObject({ type: 'sudestada', startsAt: iso(39), endsAt: iso(39) });
  });

  it('avisa también a menos del margen del límite', () => {
    // Bajamar 0.40 con mínimo 0.35: queda adentro, pero a menos de 0.1 m.
    const [a] = mooringAlerts(proj, { safeMinM: 0.35 }, iso(0));
    expect(a.message).toContain('al límite de tu mínimo');
    expect(mooringAlerts(proj, { safeMinM: 0.25 }, iso(0))).toHaveLength(0);
  });

  it('sólo de ahora en adelante', () => {
    const a = mooringAlerts(proj, { safeMinM: 0.6, safeMaxM: 2.0 }, iso(10));
    expect(a.map((x) => x.type)).toEqual(['sudestada']);
  });
});

describe('combineWaterAlerts', () => {
  const regional = (severity: 1 | 2 | 3, days: SurgeAlert['days']): SurgeAlert => ({
    type: 'sudestada',
    startsAt: `${days[0].date}T00:00`,
    endsAt: `${days.at(-1)!.date}T23:00`,
    durationH: 24 * days.length,
    severity,
    confidence: 0.85,
    avgWindKt: 12,
    source: 'nivel',
    days,
    message: 'Agua alta prevista',
  });

  it('sin estimación de la amarra quedan las regionales', () => {
    const r = [regional(2, [{ date: '2026-11-20', hours: 24, severity: 2 }])];
    expect(combineWaterAlerts(r, null)).toBe(r);
  });

  it('con estimación, de las regionales sólo quedan los días severos', () => {
    const r = [
      regional(2, [{ date: '2026-11-20', hours: 24, severity: 2 }]),
      regional(3, [
        { date: '2026-11-21', hours: 24, severity: 2 },
        { date: '2026-11-22', hours: 24, severity: 3 },
      ]),
    ];
    const out = combineWaterAlerts(r, []);
    expect(out).toHaveLength(1);
    expect(out[0].days).toEqual([{ date: '2026-11-22', hours: 24, severity: 3 }]);
  });
});

describe('aviso de la amarra en el semáforo', () => {
  it('pone el día en amarillo con el mensaje de la amarra', () => {
    const hourly: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => ({
      time: iso(h),
      windKt: 10,
      gustKt: 14,
      windDir: 90,
      precipMm: 0,
      tempC: 20,
    }));
    const proj: MooringProjection = {
      offsetM: 0,
      calibHours: 72,
      points: hourly.map((p, h) => ({ time: p.time, m: h === 6 ? 0.3 : 1.2 })),
    };
    const alerts = mooringAlerts(proj, { safeMinM: 0.6 }, iso(0));
    const [day] = scoreDays(hourly, undefined, alerts);
    expect(day.level).toBe('amarillo');
    expect(day.reasons.some((r) => r.includes('poca agua en tu amarra'))).toBe(true);
  });
});
