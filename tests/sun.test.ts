import { describe, it, expect } from 'vitest';
import { sunEvent, daylightHours } from '@/lib/domain/sun';

// Buenos Aires (referencia). Valores reales (UTC−3), tolerancia ~15 min.
const BA = { lat: -34.61, lon: -58.38 };

describe('sun', () => {
  it('solsticio de invierno en BA: amanece ~08:00, atardece ~17:50', () => {
    const sr = sunEvent('2026-06-21', BA.lat, BA.lon, true)!;
    const ss = sunEvent('2026-06-21', BA.lat, BA.lon, false)!;
    expect(sr).toBeCloseTo(8.0, 0);
    expect(ss).toBeGreaterThan(17.6);
    expect(ss).toBeLessThan(18.1);
  });

  it('solsticio de verano en BA: amanece ~05:37, atardece ~20:06', () => {
    const sr = sunEvent('2026-12-21', BA.lat, BA.lon, true)!;
    const ss = sunEvent('2026-12-21', BA.lat, BA.lon, false)!;
    expect(sr).toBeGreaterThan(5.4);
    expect(sr).toBeLessThan(5.9);
    expect(ss).toBeGreaterThan(19.9);
    expect(ss).toBeLessThan(20.3);
  });

  it('el día es más largo en verano que en invierno', () => {
    const winter = sunEvent('2026-06-21', BA.lat, BA.lon, false)! - sunEvent('2026-06-21', BA.lat, BA.lon, true)!;
    const summer = sunEvent('2026-12-21', BA.lat, BA.lon, false)! - sunEvent('2026-12-21', BA.lat, BA.lon, true)!;
    expect(summer).toBeGreaterThan(winter);
    expect(winter).toBeGreaterThan(9); // ~9h50m
    expect(summer).toBeGreaterThan(14); // ~14h30m
  });

  it('daylightHours sin lugar cae a las horas fijas (7–19)', () => {
    expect(daylightHours('2026-06-21')).toEqual({ sunriseHour: 7, sunsetHour: 19 });
  });

  it('daylightHours con lugar redondea el amanecer/atardecer reales (invierno: 8–18)', () => {
    expect(daylightHours('2026-06-21', BA)).toEqual({ sunriseHour: 8, sunsetHour: 18 });
  });

  it('daylightHours con lugar ensancha la ventana en verano', () => {
    const summer = daylightHours('2026-12-21', BA);
    expect(summer.sunriseHour).toBeLessThanOrEqual(6);
    expect(summer.sunsetHour).toBeGreaterThanOrEqual(20);
  });
});
