import { describe, it, expect } from 'vitest';
import { scoreDay } from '@/lib/domain/scoring';
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

  it('viento flojo => amarillo', () => {
    const s = scoreDay('2026-06-18', day('2026-06-18', 4, 8));
    expect(s.level).toBe('amarillo');
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
});
