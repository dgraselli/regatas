import { describe, it, expect } from 'vitest';
import {
  haversineNm,
  initialBearing,
  trueWindAngle,
  angularDiff,
  inSector,
} from '@/lib/domain/geo';

describe('geo', () => {
  it('haversine: La Plata → Colonia ~26 NM', () => {
    const d = haversineNm(-34.9, -57.95, -34.47, -57.84);
    expect(d).toBeGreaterThan(22);
    expect(d).toBeLessThan(30);
  });

  it('initialBearing apunta al norte', () => {
    const b = initialBearing(-34.9, -57.95, -34.4, -57.95);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(5);
  });

  it('trueWindAngle: viento de proa = 0', () => {
    expect(trueWindAngle(0, 0)).toBe(0);
    expect(trueWindAngle(90, 90)).toBe(0);
  });

  it('trueWindAngle: viento de popa = 180', () => {
    expect(trueWindAngle(0, 180)).toBe(180);
  });

  it('trueWindAngle: viento de través = 90', () => {
    expect(trueWindAngle(0, 90)).toBe(90);
    expect(trueWindAngle(0, 270)).toBe(90);
  });

  it('angularDiff es simétrico y <=180', () => {
    expect(angularDiff(350, 10)).toBe(20);
    expect(angularDiff(10, 350)).toBe(20);
  });

  it('inSector maneja sectores que cruzan el norte', () => {
    expect(inSector(135, [112, 157])).toBe(true); // SE
    expect(inSector(200, [112, 157])).toBe(false);
    expect(inSector(315, [292, 22])).toBe(true); // NW (cruza 0)
    expect(inSector(10, [292, 22])).toBe(true);
    expect(inSector(180, [292, 22])).toBe(false);
  });
});
