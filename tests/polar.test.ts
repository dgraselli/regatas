import { describe, it, expect } from 'vitest';
import { boatSpeed, vmg } from '@/lib/domain/polar';
import type { BoatPolar } from '@/lib/types/config';

// Polar de prueba explícita (independiente de la config) para verificar la interpolación.
const POLAR: BoatPolar = {
  twaPoints: [0, 40, 90, 180],
  twsPoints: [10, 20],
  speeds: [
    [0, 0], // 0   zona muerta
    [0, 0], // 40  zona muerta
    [5, 6], // 90  través
    [3, 4], // 180 popa
  ],
};

describe('polar', () => {
  it('coincide en los puntos de la grilla', () => {
    expect(boatSpeed(POLAR, 90, 10)).toBeCloseTo(5, 5);
    expect(boatSpeed(POLAR, 90, 20)).toBeCloseTo(6, 5);
  });

  it('interpola en TWS', () => {
    expect(boatSpeed(POLAR, 90, 15)).toBeCloseTo(5.5, 5);
  });

  it('interpola en TWA', () => {
    // entre TWA 90 (5) y 180 (3) a mitad de camino (135) con TWS 10 => 4
    expect(boatSpeed(POLAR, 135, 10)).toBeCloseTo(4, 5);
  });

  it('en la zona muerta la velocidad es ~0', () => {
    expect(boatSpeed(POLAR, 0, 10)).toBe(0);
    expect(boatSpeed(POLAR, 40, 10)).toBe(0);
  });

  it('clampea fuera de rango', () => {
    expect(boatSpeed(POLAR, 90, 100)).toBeCloseTo(6, 5); // tope TWS 20
    expect(boatSpeed(POLAR, 90, 1)).toBeCloseTo(5, 5); // piso TWS 10
  });

  it('vmg de través es ~0, de ceñida positivo', () => {
    expect(vmg(7, 90)).toBeCloseTo(0, 5);
    expect(vmg(6, 45)).toBeGreaterThan(0);
  });
});
