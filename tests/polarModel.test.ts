import { describe, it, expect } from 'vitest';
import { generatePolar, deriveRouting, hullSpeedKt } from '@/lib/domain/polarModel';
import { boatSpeed } from '@/lib/domain/polar';

describe('polarModel', () => {
  it('un barco más grande tiene mayor velocidad de casco', () => {
    expect(hullSpeedKt(35)).toBeGreaterThan(hullSpeedKt(23));
  });

  it('genera una polar coherente para un 23 pies (~5.8 kt al través)', () => {
    const p = generatePolar(23);
    const beam = boatSpeed(p, 90, 20);
    expect(beam).toBeGreaterThan(5);
    expect(beam).toBeLessThan(6.5);
  });

  it('la velocidad escala con la eslora', () => {
    const small = boatSpeed(generatePolar(20), 90, 20);
    const big = boatSpeed(generatePolar(38), 90, 20);
    expect(big).toBeGreaterThan(small);
  });

  it('la proa (zona muerta) siempre da 0', () => {
    const p = generatePolar(30);
    expect(boatSpeed(p, 0, 20)).toBe(0);
    expect(boatSpeed(p, 30, 20)).toBe(0);
  });

  it('los barcos chicos ciñen peor (noGoAngle mayor)', () => {
    expect(deriveRouting(22).noGoAngle).toBeGreaterThan(deriveRouting(36).noGoAngle);
  });
});
