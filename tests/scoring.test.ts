import { describe, it, expect } from 'vitest';
import { scoreDay } from '@/lib/domain/scoring';
import { scoringFor } from '@/lib/config/boat';
import type { HourlyPoint } from '@/lib/types/forecast';
import type { SurgeAlert } from '@/lib/types/water';

function day(date: string, wind: number, gust: number, rain = 0, dir = 270): HourlyPoint[] {
  return Array.from({ length: 24 }, (_, h) => ({
    time: `${date}T${String(h).padStart(2, '0')}:00`,
    windKt: wind,
    gustKt: gust,
    windDir: dir,
    precipMm: h >= 8 && h <= 16 ? rain : 0,
    tempC: 15,
  }));
}

/** Día con viento ideal y una visibilidad mínima dada en TODAS las horas de luz. */
function foggyDay(date: string, visM: number, wind = 12): HourlyPoint[] {
  return day(date, wind, wind + 4).map((p) => ({ ...p, visibilityM: visM }));
}

/** Día con niebla (visM) desde la madrugada hasta `untilHour`, despejado después. */
function dayWithMorningFog(
  date: string,
  visM: number,
  untilHour: number,
  wind = 12,
): HourlyPoint[] {
  return day(date, wind, wind + 4).map((p) => {
    const h = Number(p.time.slice(11, 13));
    return { ...p, visibilityM: h >= 5 && h <= untilHour ? visM : 20000 };
  });
}

describe('scoring', () => {
  it('día ideal => verde', () => {
    const s = scoreDay('2026-06-18', day('2026-06-18', 12, 16));
    expect(s.level).toBe('verde');
  });

  it('viento fuerte => amarillo', () => {
    const s = scoreDay('2026-06-18', day('2026-06-18', 23, 27));
    expect(s.level).toBe('amarillo');
  });

  it('viento peligroso => rojo', () => {
    const s = scoreDay('2026-06-18', day('2026-06-18', 30, 40));
    expect(s.level).toBe('rojo');
  });

  it('viento flojo => poco-viento (no precaución)', () => {
    const s = scoreDay('2026-06-18', day('2026-06-18', 4, 8));
    expect(s.level).toBe('poco-viento');
    expect(s.reasons.join(' ')).toMatch(/poco viento/i);
  });

  it('poco viento sigue siendo poco-viento en cualquier perfil (incluido audaz)', () => {
    const flojo = day('2026-06-18', 5, 9);
    for (const caution of ['prudente', 'normal', 'audaz'] as const) {
      const s = scoreDay('2026-06-18', flojo, scoringFor(caution));
      expect(s.level).toBe('poco-viento');
    }
  });

  it('lluvia fuerte => rojo', () => {
    const s = scoreDay('2026-06-18', day('2026-06-18', 12, 16, 3));
    // 3mm * 9 horas = 27mm > rainRed
    expect(s.level).toBe('rojo');
  });

  it('alerta de surge severa degrada a rojo', () => {
    const surge: SurgeAlert[] = [
      {
        type: 'sudestada',
        startsAt: '2026-06-18T08:00',
        endsAt: '2026-06-18T20:00',
        durationH: 12,
        severity: 3,
        confidence: 0.8,
        avgWindKt: 25,
        message: 'Sudestada severa',
      },
    ];
    const s = scoreDay('2026-06-18', day('2026-06-18', 12, 16), undefined, surge);
    expect(s.level).toBe('rojo');
    expect(s.reasons).toContain('Sudestada severa');
  });

  it('niebla densa todo el día => rojo', () => {
    const s = scoreDay('2026-06-18', foggyDay('2026-06-18', 600));
    expect(s.level).toBe('rojo');
    expect(s.reasons.join(' ')).toMatch(/niebla/i);
    expect(s.metrics.visibilityMinM).toBe(600);
  });

  it('niebla densa solo a la mañana que despeja => amarillo, no rojo', () => {
    const s = scoreDay('2026-06-18', dayWithMorningFog('2026-06-18', 500, 9));
    expect(s.level).toBe('amarillo');
    expect(s.reasons.join(' ')).toMatch(/navegable después/i);
  });

  it('niebla densa casi todo el día (sin ventana después) => rojo', () => {
    const s = scoreDay('2026-06-18', dayWithMorningFog('2026-06-18', 500, 17));
    expect(s.level).toBe('rojo');
  });

  it('visibilidad reducida => amarillo', () => {
    const s = scoreDay('2026-06-18', foggyDay('2026-06-18', 3000));
    expect(s.level).toBe('amarillo');
    expect(s.reasons.join(' ')).toMatch(/visibilidad reducida/i);
  });

  it('buena visibilidad no penaliza', () => {
    const s = scoreDay('2026-06-18', foggyDay('2026-06-18', 20000));
    expect(s.level).toBe('verde');
  });

  it('la sensibilidad a la niebla sigue la tolerancia', () => {
    // 1500 m: el prudente lo ve peligroso (rojo), el normal lo ve reducido (amarillo).
    const niebla = foggyDay('2026-06-18', 1500);
    expect(scoreDay('2026-06-18', niebla, scoringFor('prudente')).level).toBe('rojo');
    expect(scoreDay('2026-06-18', niebla, scoringFor('normal')).level).toBe('amarillo');
  });

  it('sin dato de visibilidad no rompe ni penaliza', () => {
    const s = scoreDay('2026-06-18', day('2026-06-18', 12, 16));
    expect(s.level).toBe('verde');
    expect(s.metrics.visibilityMinM).toBeUndefined();
  });
});
