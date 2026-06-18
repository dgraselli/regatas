import type { BoatPolar, RoutingConfig } from '@/lib/types/config';

/**
 * Genera una polar aproximada a partir de la eslora del velero, para que
 * cualquier usuario reciba estimaciones razonables sin cargar una polar real.
 *
 * Modelo: velocidad de casco ≈ 1.34·√(LWL_ft), con LWL ≈ 0.82·LOA. Esa velocidad
 * se modula por un factor de ángulo al viento (TWA) y un factor de intensidad (TWS).
 * Es una aproximación orientativa, no una polar medida.
 */

const TWA_POINTS = [0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180];
const TWS_POINTS = [5, 10, 15, 20, 25];

// Fracción de la velocidad potencial alcanzable según el rumbo al viento.
const ANGLE_FACTOR = [
  0.0, // 0   de proa
  0.0, // 30  zona muerta
  0.8, // 40  límite de ceñida (usado al bordejear)
  0.86, // 52 ceñida
  0.92, // 60
  0.97, // 75
  1.0, // 90  través (óptimo)
  1.0, // 110
  0.97, // 120 aleta
  0.9, // 135
  0.8, // 150
  0.67, // 165
  0.6, // 180 popa
];

// Cuánto del potencial se alcanza según la intensidad del viento.
const WIND_FACTOR = [0.6, 0.84, 0.95, 1.0, 1.0];

export function hullSpeedKt(lengthFt: number): number {
  const lwl = 0.82 * lengthFt;
  return 1.34 * Math.sqrt(lwl);
}

export function generatePolar(lengthFt: number): BoatPolar {
  const hull = hullSpeedKt(lengthFt);
  const speeds = ANGLE_FACTOR.map((af) =>
    WIND_FACTOR.map((wf) => Math.round(hull * af * wf * 10) / 10),
  );
  return { twaPoints: [...TWA_POINTS], twsPoints: [...TWS_POINTS], speeds };
}

/** Parámetros de navegación derivados de la eslora (los barcos chicos ciñen peor). */
export function deriveRouting(lengthFt: number): RoutingConfig {
  if (lengthFt < 26) {
    return { noGoAngle: 45, tackingEfficiency: 0.6, reefGust: 22 };
  }
  if (lengthFt < 34) {
    return { noGoAngle: 42, tackingEfficiency: 0.63, reefGust: 25 };
  }
  return { noGoAngle: 40, tackingEfficiency: 0.66, reefGust: 28 };
}
