import { describe, it, expect } from 'vitest';
import { todayInTz, nowInTz, minutesSince } from '@/lib/format';

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

describe('nowInTz', () => {
  it('devuelve YYYY-MM-DDTHH:mm en la zona horaria dada', () => {
    // 2026-07-08 17:32 UTC = 14:32 en Buenos Aires (UTC-3).
    const now = new Date('2026-07-08T17:32:00Z');
    expect(nowInTz(TZ, now)).toBe('2026-07-08T14:32');
  });

  it('cruza la medianoche cambiando de fecha (sin hora 24)', () => {
    // 2026-07-08 03:00 UTC = 2026-07-08 00:00 en Buenos Aires.
    const now = new Date('2026-07-08T03:00:00Z');
    expect(nowInTz(TZ, now)).toBe('2026-07-08T00:00');
  });

  it('coincide en formato con los puntos horarios del pronóstico', () => {
    const now = new Date('2026-07-08T17:32:00Z');
    const value = nowInTz(TZ, now);
    expect(value.slice(0, 10)).toBe(todayInTz(TZ, now));
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('minutesSince', () => {
  // El nivel del INA llega como texto naive en hora argentina: '2026-09-03T17:45'.
  const now = new Date('2026-09-03T22:43:00Z'); // = 19:43 en Buenos Aires

  it('mide la antigüedad de una observación naive contra el ahora de esa zona', () => {
    expect(minutesSince('2026-09-03T17:45', TZ, now)).toBe(118);
  });

  it('no depende de la zona horaria del dispositivo', () => {
    // El mismo instante, expresado en otra zona: el desfasaje se cancela porque
    // el "ahora" también se convierte. Con `new Date(iso)` esto daría 3 h de más.
    const enMontevideo = minutesSince('2026-09-03T17:45', TZ, now);
    const enUTC = minutesSince('2026-09-03T20:45', 'UTC', now);
    expect(enMontevideo).toBe(enUTC);
  });

  it('da negativo si el timestamp es futuro', () => {
    expect(minutesSince('2026-09-03T20:43', TZ, now)).toBe(-60);
  });

  it('devuelve null si el timestamp es inválido', () => {
    expect(minutesSince('', TZ, now)).toBeNull();
    expect(minutesSince('no-es-una-fecha', TZ, now)).toBeNull();
  });
});
