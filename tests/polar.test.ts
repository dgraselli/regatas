import { describe, it, expect } from 'vitest';
import { boatSpeed, vmg } from '@/lib/domain/polar';
import { DEFAULT_POLAR } from '@/lib/config/boat';

describe('polar', () => {
  it('coincide en los puntos de la grilla', () => {
    // TWA 90 (índice 6), TWS 15 (índice 2) => 7.0
    expect(boatSpeed(DEFAULT_POLAR, 90, 15)).toBeCloseTo(7.0, 5);
  });

  it('interpola entre puntos', () => {
    const s = boatSpeed(DEFAULT_POLAR, 90, 12.5); // entre TWS 10 (6.4) y 15 (7.0)
    expect(s).toBeGreaterThan(6.4);
    expect(s).toBeLessThan(7.0);
  });

  it('en la zona muerta la velocidad es ~0', () => {
    expect(boatSpeed(DEFAULT_POLAR, 0, 15)).toBe(0);
    expect(boatSpeed(DEFAULT_POLAR, 30, 15)).toBe(0);
  });

  it('clampea fuera de rango', () => {
    expect(boatSpeed(DEFAULT_POLAR, 90, 100)).toBeCloseTo(7.3, 5); // tope TWS 25
    expect(boatSpeed(DEFAULT_POLAR, 90, 1)).toBeCloseTo(5.3, 5); // piso TWS 5
  });

  it('vmg de través es ~0, de ceñida positivo', () => {
    expect(vmg(7, 90)).toBeCloseTo(0, 5);
    expect(vmg(6, 45)).toBeGreaterThan(0);
  });
});
