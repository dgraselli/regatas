import { describe, it, expect } from 'vitest';
import { todayInTz } from '@/lib/format';

const TZ = 'America/Argentina/Buenos_Aires';

describe('todayInTz', () => {
  it('devuelve YYYY-MM-DD en la zona horaria dada', () => {
    // 2026-07-08 03:00 UTC → aún 2026-07-08 00:00 en Buenos Aires (UTC-3).
    const now = new Date('2026-07-08T03:00:00Z');
    expect(todayInTz(TZ, now)).toBe('2026-07-08');
  });

  it('respeta el desfasaje de zona horaria en el cruce de medianoche', () => {
    // 2026-07-08 02:00 UTC = 2026-07-07 23:00 en Buenos Aires → sigue siendo el 7.
    const now = new Date('2026-07-08T02:00:00Z');
    expect(todayInTz(TZ, now)).toBe('2026-07-07');
  });

  it('sirve para filtrar días ya pasados de un pronóstico cacheado', () => {
    const now = new Date('2026-07-08T12:00:00Z');
    const today = todayInTz(TZ, now); // '2026-07-08'
    const cachedDays = [
      { date: '2026-07-06' }, // pasado
      { date: '2026-07-07' }, // pasado
      { date: '2026-07-08' }, // hoy
      { date: '2026-07-09' }, // futuro
      { date: '2026-07-10' }, // futuro
    ];
    const visible = cachedDays.filter((d) => d.date >= today).map((d) => d.date);
    expect(visible).toEqual(['2026-07-08', '2026-07-09', '2026-07-10']);
  });
});
