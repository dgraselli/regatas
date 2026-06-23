import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOCATIONS,
  FALLBACK_LOCATION_ID,
  nearestLocationId,
} from '@/lib/profile/defaults';

describe('nearestLocationId', () => {
  it('elige el lugar más cercano a la coordenada', () => {
    // Centro de La Plata
    expect(nearestLocationId(DEFAULT_LOCATIONS, -34.92, -57.95)).toBe('la-plata');
    // Microcentro porteño
    expect(nearestLocationId(DEFAULT_LOCATIONS, -34.6, -58.38)).toBe('buenos-aires');
    // Carmelo (UY)
    expect(nearestLocationId(DEFAULT_LOCATIONS, -34.0, -58.29)).toBe('carmelo');
    // Colonia (UY)
    expect(nearestLocationId(DEFAULT_LOCATIONS, -34.47, -57.85)).toBe('colonia');
  });

  it('devuelve null si no hay lugares', () => {
    expect(nearestLocationId([], -34.9, -57.9)).toBeNull();
  });

  it('el fallback es uno de los lugares por defecto', () => {
    expect(DEFAULT_LOCATIONS.some((l) => l.id === FALLBACK_LOCATION_ID)).toBe(true);
  });
});
