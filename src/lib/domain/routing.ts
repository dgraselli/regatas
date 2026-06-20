import type { HourlyPoint } from '@/lib/types/forecast';
import type { Route, BoatPolar, RoutingConfig } from '@/lib/types/config';
import type {
  Leg,
  DepartureCandidate,
  CrossingPlan,
} from '@/lib/types/crossing';
import { DEFAULT_POLAR, ROUTING, DAYLIGHT } from '@/lib/config/boat';
import { haversineNm, initialBearing, trueWindAngle } from '@/lib/domain/geo';
import { boatSpeed } from '@/lib/domain/polar';
import { pointOfSail } from '@/lib/domain/pointOfSail';

const hourOf = (iso: string) => Number(iso.slice(11, 13));

/** Suma horas a un ISO local 'YYYY-MM-DDTHH:mm' preservando la hora de pared. */
export function addHoursIso(iso: string, hours: number): string {
  const base = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
    Number(iso.slice(11, 13)),
    Number(iso.slice(14, 16) || '0'),
  );
  const d = new Date(base + hours * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(
    d.getUTCHours(),
  )}:${p(d.getUTCMinutes())}`;
}

interface PrecomputedLeg {
  fromName: string;
  toName: string;
  bearing: number;
  distanceNm: number;
}

function precomputeLegs(route: Route): PrecomputedLeg[] {
  const legs: PrecomputedLeg[] = [];
  for (let i = 0; i < route.waypoints.length - 1; i++) {
    const a = route.waypoints[i];
    const b = route.waypoints[i + 1];
    legs.push({
      fromName: a.name,
      toName: b.name,
      bearing: Math.round(initialBearing(a.lat, a.lon, b.lat, b.lon)),
      distanceNm: Math.round(haversineNm(a.lat, a.lon, b.lat, b.lon) * 10) / 10,
    });
  }
  return legs;
}

/** Simula el cruce para una hora de salida dada (índice en el arreglo horario). */
function simulate(
  legsGeo: PrecomputedLeg[],
  hourly: HourlyPoint[],
  startIdx: number,
  polar: BoatPolar,
  cfg: RoutingConfig,
): DepartureCandidate {
  const legs: Leg[] = [];
  const warnings: string[] = [];
  let elapsed = 0;

  for (const g of legsGeo) {
    const idx = Math.min(hourly.length - 1, startIdx + Math.floor(elapsed));
    const fc = hourly[idx];
    const twa = trueWindAngle(g.bearing, fc.windDir);

    let boatKt: number;
    if (twa < cfg.noGoAngle) {
      // Zona muerta: hay que ceñir/virar. Progreso reducido sobre el rumbo deseado.
      boatKt =
        Math.round(boatSpeed(polar, cfg.noGoAngle, fc.windKt) * cfg.tackingEfficiency * 10) /
        10;
    } else {
      boatKt = Math.round(boatSpeed(polar, twa, fc.windKt) * 10) / 10;
    }

    const legWarnings: string[] = [];
    if (fc.gustKt >= cfg.reefGust) {
      legWarnings.push(`Ráfagas de ${Math.round(fc.gustKt)} kt: conviene tomar rizos.`);
    }
    if (twa < cfg.noGoAngle) {
      legWarnings.push('Rumbo en zona muerta: requiere bordejear (virar repetido).');
    }
    if (twa >= 70 && twa <= 110 && fc.windKt >= 22) {
      legWarnings.push('Mar de través con viento fuerte: navegación incómoda.');
    }

    const hours = boatKt > 0.3 ? g.distanceNm / boatKt : 99;

    legs.push({
      fromName: g.fromName,
      toName: g.toName,
      bearing: g.bearing,
      distanceNm: g.distanceNm,
      windDir: Math.round(fc.windDir),
      windKt: Math.round(fc.windKt),
      gustKt: Math.round(fc.gustKt),
      twa: Math.round(twa),
      pointOfSail: pointOfSail(twa, cfg.noGoAngle),
      boatKt,
      hours: Math.round(hours * 100) / 100,
      warnings: legWarnings,
    });

    warnings.push(...legWarnings);
    elapsed += hours;
  }

  const departAt = hourly[startIdx].time;
  const totalHours = Math.round(elapsed * 100) / 100;
  const arriveAt = addHoursIso(departAt, totalHours);
  const arriveHour = hourOf(arriveAt);
  const arrivesAtNight =
    arriveHour < DAYLIGHT.sunriseHour || arriveHour > DAYLIGHT.sunsetHour;

  // Costo: tiempo + penalizaciones por seguridad/confort.
  const uniqueWarnings = Array.from(new Set(warnings));
  let cost = totalHours;
  cost += uniqueWarnings.length * 1.5;
  if (arrivesAtNight) cost += 4;

  const candidateWarnings = [...uniqueWarnings];
  if (arrivesAtNight) candidateWarnings.push('Llegada estimada de noche.');

  return {
    departAt,
    arriveAt,
    totalHours,
    legs,
    warnings: candidateWarnings,
    cost: Math.round(cost * 100) / 100,
    arrivesAtNight,
  };
}

export interface PlanOptions {
  /** Cada cuántas horas evaluar una salida candidata. */
  stepHours?: number;
  /** Horizonte máximo de salidas a evaluar (horas desde el inicio del pronóstico). */
  horizonHours?: number;
  /** Solo considerar salidas en horario diurno. */
  daylightOnly?: boolean;
}

/**
 * Planifica el cruce evaluando múltiples horas de salida sobre la derrota fija
 * y rankeándolas por tiempo total y seguridad/confort.
 */
export function planCrossing(
  route: Route,
  hourly: HourlyPoint[],
  polar: BoatPolar = DEFAULT_POLAR,
  cfg: RoutingConfig = ROUTING,
  options: PlanOptions = {},
): CrossingPlan {
  const { stepHours = 3, horizonHours = 72, daylightOnly = true } = options;
  const legsGeo = precomputeLegs(route);

  const candidates: DepartureCandidate[] = [];
  const maxIdx = Math.min(hourly.length - 1, horizonHours);
  for (let idx = 0; idx <= maxIdx; idx += stepHours) {
    const h = hourOf(hourly[idx].time);
    if (daylightOnly && (h < DAYLIGHT.sunriseHour || h > DAYLIGHT.sunsetHour - 2)) {
      continue;
    }
    candidates.push(simulate(legsGeo, hourly, idx, polar, cfg));
  }

  const ranked = candidates.sort((a, b) => a.cost - b.cost);
  return {
    routeId: route.id,
    routeName: route.name,
    best: ranked[0] ?? null,
    ranked,
    computedAt: hourly[0]?.time ?? '',
  };
}
