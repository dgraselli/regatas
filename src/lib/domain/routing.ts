import type { HourlyPoint, TrafficLevel } from '@/lib/types/forecast';
import type {
  Route,
  BoatPolar,
  RoutingConfig,
  ScoringThresholds,
  Propulsion,
} from '@/lib/types/config';
import type {
  Leg,
  DepartureCandidate,
  CrossingPlan,
} from '@/lib/types/crossing';
import type { SurgeAlert } from '@/lib/types/water';
import { DEFAULT_POLAR, ROUTING, SCORING, DEFAULT_CRUISE_KT } from '@/lib/config/boat';
import { daylightHours } from '@/lib/domain/sun';
import { haversineNm, initialBearing, trueWindAngle } from '@/lib/domain/geo';
import { boatSpeed } from '@/lib/domain/polar';
import {
  pointOfSail,
  waveSector,
  waveSeverityFactor,
  type WaveSector,
} from '@/lib/domain/pointOfSail';
import { detectSurge } from '@/lib/domain/surge';

const hourOf = (iso: string) => Number(iso.slice(11, 13));
const dateOf = (iso: string) => iso.slice(0, 10);

/** Visibilidad legible: metros por debajo de 1 km, km con un decimal por encima. */
const formatVis = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

/** Penalización de costo por nivel: garantiza verde < amarillo < rojo en el ranking. */
const LEVEL_COST: Record<TrafficLevel, number> = { verde: 0, 'poco-viento': 0, amarillo: 20, rojo: 200 };

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

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

/** Tope de horas a simular para un cruce (evita bucles si el barco no avanza). */
const MAX_SEGMENTS = 24;

/** Ráfaga (kt) a partir de la cual se advierte mar formado a una embarcación a motor. */
const MOTOR_ROUGH_GUST = 25;

/**
 * Simula el cruce directo (rumbo único) para una hora de salida dada, avanzando
 * hora por hora con el viento de cada hora hasta cubrir la distancia. Cada tramo
 * de la simulación es ~1 h de navegación sobre el mismo rumbo.
 */
function simulate(
  course: number,
  totalNm: number,
  hourly: HourlyPoint[],
  startIdx: number,
  polar: BoatPolar,
  cfg: RoutingConfig,
  surge: SurgeAlert[],
  thresholds: ScoringThresholds,
  propulsion: Propulsion,
  cruiseKt: number,
  location: { lat: number; lon: number } | undefined,
): DepartureCandidate {
  const isMotor = propulsion === 'motor';
  const legs: Leg[] = [];
  const warnings: string[] = [];
  let remaining = totalNm;
  let elapsed = 0;
  let completes = false;
  let minVisM: number | undefined;

  for (let k = 0; k < MAX_SEGMENTS && remaining > 0.05; k++) {
    const idx = Math.min(hourly.length - 1, startIdx + k);
    const fc = hourly[idx];
    if (fc.visibilityM != null) {
      minVisM = minVisM === undefined ? fc.visibilityM : Math.min(minVisM, fc.visibilityM);
    }
    const twa = trueWindAngle(course, fc.windDir);

    // Ola respecto del rumbo: de proa → cabeceo, de través → balanceo. Afecta a
    // vela y a motor por igual (es el mar, no el viento). Grilla marina gruesa.
    let waveHeightM: number | undefined;
    let waveAngle: number | undefined;
    let sector: WaveSector | undefined;
    if (fc.waveHeightM != null) {
      waveHeightM = Math.round(fc.waveHeightM * 10) / 10;
      if (fc.waveDir != null) {
        waveAngle = Math.round(trueWindAngle(course, fc.waveDir));
        sector = waveSector(waveAngle);
      }
    }

    // A motor la velocidad es de crucero (constante), independiente del ángulo al
    // viento. A vela sale de la polar, con penalización si el rumbo cae en zona muerta.
    let boatKt: number;
    if (isMotor) {
      boatKt = cruiseKt;
    } else if (twa < cfg.noGoAngle) {
      // Zona muerta: hay que ceñir/virar. Progreso reducido sobre el rumbo deseado.
      boatKt =
        Math.round(boatSpeed(polar, cfg.noGoAngle, fc.windKt) * cfg.tackingEfficiency * 10) /
        10;
    } else {
      boatKt = Math.round(boatSpeed(polar, twa, fc.windKt) * 10) / 10;
    }

    const legWarnings: string[] = [];
    if (isMotor) {
      if (fc.gustKt >= MOTOR_ROUGH_GUST) {
        legWarnings.push(`Ráfagas de ${Math.round(fc.gustKt)} kt: mar formado, navegación dura.`);
      }
    } else {
      if (fc.gustKt >= cfg.reefGust) {
        legWarnings.push(`Ráfagas de ${Math.round(fc.gustKt)} kt: conviene tomar rizos.`);
      }
      if (twa < cfg.noGoAngle) {
        legWarnings.push('Rumbo en zona muerta: requiere bordejear (virar repetido).');
      }
      if (twa >= 70 && twa <= 110 && fc.windKt >= 22) {
        legWarnings.push('Mar de través con viento fuerte: navegación incómoda.');
      }
    }
    // Advertencia por la ola de proa/través (vale para vela y motor). El resumen
    // del candidato lleva una sola línea con el pico (se arma tras el bucle).
    if (waveHeightM != null && waveHeightM >= thresholds.waveYellowM && sector != null) {
      const hs = waveHeightM.toFixed(1);
      const short = fc.wavePeriodS != null && fc.wavePeriodS < 5;
      if (sector === 'proa') {
        legWarnings.push(`Mar de proa (~${hs} m${short ? ', corta y empinada' : ''}): cabeceo, se moja y frena.`);
      } else if (sector === 'través') {
        legWarnings.push(`Mar de través (~${hs} m): balanceo incómodo.`);
      }
    }

    // Avance del tramo: hasta 1 h, o lo que falte para llegar.
    const dt = boatKt < 0.3 ? 1 : Math.min(1, remaining / boatKt);
    const segNm = Math.round(boatKt * dt * 10) / 10;
    remaining = Math.round((remaining - boatKt * dt) * 100) / 100;
    if (remaining <= 0.05) {
      completes = true;
      remaining = 0;
    }
    elapsed += dt;

    legs.push({
      time: fc.time,
      windDir: Math.round(fc.windDir),
      windKt: Math.round(fc.windKt),
      gustKt: Math.round(fc.gustKt),
      twa: Math.round(twa),
      pointOfSail: pointOfSail(twa, cfg.noGoAngle),
      boatKt,
      segmentNm: segNm,
      cumulativeNm: Math.round((totalNm - remaining) * 10) / 10,
      hours: Math.round(dt * 100) / 100,
      waveHeightM,
      waveAngle,
      waveSector: sector,
      warnings: legWarnings,
    });

    // La ráfaga y la ola por-hora quedan en el tramo (LegTable); al resumen del
    // candidato va una sola advertencia de cada una con el pico (tras el bucle).
    warnings.push(
      ...legWarnings.filter((w) => !w.startsWith('Ráfagas de') && !w.startsWith('Mar de proa') && !w.startsWith('Mar de través (')),
    );
  }

  if (!completes) {
    warnings.push(
      isMotor
        ? 'No completa el cruce en el horizonte simulado (distancia muy larga para la velocidad de crucero).'
        : 'No completa el cruce en el horizonte simulado (viento muy flojo o de proa).',
    );
  }

  const departAt = hourly[startIdx].time;
  const totalHours = Math.round(elapsed * 100) / 100;
  const arriveAt = addHoursIso(departAt, totalHours);
  const arriveHour = hourOf(arriveAt);
  const arriveDaylight = daylightHours(dateOf(arriveAt), location);
  const arrivesAtNight =
    completes &&
    (arriveHour < arriveDaylight.sunriseHour || arriveHour > arriveDaylight.sunsetHour);

  // Niebla / visibilidad: prioriza el aviso a la salida (clave para zarpar de la
  // amarra) y, si no, marca la visibilidad reducida durante el cruce.
  const departVisM = hourly[startIdx].visibilityM;
  if (departVisM != null && departVisM <= thresholds.fogYellowM) {
    warnings.push(
      departVisM <= thresholds.fogRedM
        ? `Posible niebla a la salida (visibilidad ${formatVis(departVisM)}): cuidado al zarpar.`
        : `Visibilidad reducida a la salida (${formatVis(departVisM)}).`,
    );
  } else if (minVisM != null && minVisM <= thresholds.fogYellowM) {
    warnings.push(
      minVisM <= thresholds.fogRedM
        ? `Posible niebla durante el cruce (visibilidad mín ${formatVis(minVisM)}).`
        : `Visibilidad reducida durante el cruce (mín ${formatVis(minVisM)}).`,
    );
  }

  // Marea meteorológica (sudestada/bajante) que toca la ventana del cruce.
  const overlapSurge = surge.filter((a) => a.startsAt <= arriveAt && a.endsAt >= departAt);
  for (const a of overlapSurge) {
    warnings.push(
      a.type === 'sudestada'
        ? 'Sudestada (agua alta) prevista durante el cruce: ojo al entrar/salir de la amarra.'
        : 'Bajante (agua baja) prevista durante el cruce: riesgo de varadura al entrar/salir.',
    );
  }

  // Semáforo de seguridad de ESTA salida: mismos umbrales que el panel del día,
  // pero evaluados en la ventana real del cruce (ráfaga pico, viento, niebla y
  // marea de esa franja). Así una salida peligrosa queda marcada, no disfrazada.
  const order: TrafficLevel[] = ['verde', 'amarillo', 'rojo'];
  let level: TrafficLevel = 'verde';
  const escLevel = (to: TrafficLevel) => {
    if (order.indexOf(to) > order.indexOf(level)) level = to;
  };
  const peakGust = legs.length ? Math.max(...legs.map((l) => l.gustKt)) : 0;
  const windMed = legs.length ? median(legs.map((l) => l.windKt)) : 0;
  if (windMed >= thresholds.dangerWind) escLevel('rojo');
  else if (windMed >= thresholds.strongWind) escLevel('amarillo');
  if (peakGust >= thresholds.gustRed) escLevel('rojo');
  else if (peakGust >= thresholds.gustYellow) escLevel('amarillo');
  if (minVisM != null) {
    if (minVisM <= thresholds.fogRedM) escLevel('rojo');
    else if (minVisM <= thresholds.fogYellowM) escLevel('amarillo');
  }
  // La ola escala el semáforo por su altura EFECTIVA: la dirección respecto del
  // rumbo modula el umbral (de proa/través pega de lleno; de aleta/popa molesta
  // menos). Si no hay dirección, se usa la altura tal cual (factor 1).
  const peakEffWaveM = legs.reduce((m, l) => {
    if (l.waveHeightM == null) return m;
    const eff = l.waveHeightM * (l.waveSector ? waveSeverityFactor(l.waveSector) : 1);
    return eff > m ? eff : m;
  }, 0);
  if (peakEffWaveM >= thresholds.waveRedM) escLevel('rojo');
  else if (peakEffWaveM >= thresholds.waveYellowM) escLevel('amarillo');
  for (const a of overlapSurge) escLevel(a.severity >= 2 ? 'rojo' : 'amarillo');

  // Una sola advertencia de ráfaga, con el máximo del cruce (no una por hora).
  if (isMotor) {
    if (peakGust >= MOTOR_ROUGH_GUST) {
      warnings.push(`Ráfagas de hasta ${peakGust} kt: mar formado, navegación dura.`);
    }
  } else if (peakGust >= cfg.reefGust) {
    warnings.push(`Ráfagas de hasta ${peakGust} kt: conviene tomar rizos.`);
  }

  // Una sola advertencia de ola, con el pico y el peor sector (proa/través) del cruce.
  const waveLegs = legs.filter(
    (l) =>
      l.waveHeightM != null &&
      l.waveHeightM >= thresholds.waveYellowM &&
      (l.waveSector === 'proa' || l.waveSector === 'través'),
  );
  if (waveLegs.length) {
    const worst = waveLegs.reduce((a, b) => (b.waveHeightM! > a.waveHeightM! ? b : a));
    const hs = worst.waveHeightM!.toFixed(1);
    warnings.push(
      worst.waveSector === 'proa'
        ? `Mar de proa de hasta ~${hs} m: cabeceo, se moja y frena.`
        : `Mar de través de hasta ~${hs} m: balanceo incómodo.`,
    );
  }

  // Costo: nivel (verde<amarillo<rojo) + tiempo + penalizaciones. Los cruces que
  // no completan quedan al fondo del ranking.
  const uniqueWarnings = Array.from(new Set(warnings));
  let cost = completes ? totalHours : 1000;
  cost += LEVEL_COST[level];
  cost += uniqueWarnings.length * 1.5;
  if (arrivesAtNight) cost += 4;

  const candidateWarnings = [...uniqueWarnings];
  if (arrivesAtNight) candidateWarnings.push('Llegada estimada de noche.');

  return {
    departAt,
    arriveAt,
    totalHours,
    course,
    distanceNm: Math.round(totalNm * 10) / 10,
    completes,
    level,
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
  /** Umbrales del semáforo (según la tolerancia del usuario). Default: normal. */
  thresholds?: ScoringThresholds;
  /** Tipo de propulsión del barco. Default: 'vela'. */
  propulsion?: Propulsion;
  /** Velocidad de crucero (kt) cuando `propulsion === 'motor'`. */
  cruiseKt?: number;
  /**
   * Posición para calcular el amanecer/atardecer reales (salidas diurnas y aviso
   * de "llegada de noche"). Sin ella se usan las horas de luz fijas (`DAYLIGHT`).
   */
  location?: { lat: number; lon: number };
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
  // Horizonte de salidas = todo el pronóstico (7 días), igual que el panel.
  const {
    stepHours = 3,
    horizonHours = 24 * 7,
    daylightOnly = true,
    thresholds = SCORING,
    propulsion = 'vela',
    cruiseKt = DEFAULT_CRUISE_KT,
    location,
  } = options;
  // Cruce directo: un solo rumbo y distancia, de extremo a extremo de la ruta.
  const from = route.waypoints[0];
  const to = route.waypoints[route.waypoints.length - 1];
  const course = Math.round(initialBearing(from.lat, from.lon, to.lat, to.lon));
  const totalNm = Math.round(haversineNm(from.lat, from.lon, to.lat, to.lon) * 10) / 10;

  // Eventos de marea meteorológica del horizonte (se reusan para cada salida).
  const surge = detectSurge(hourly);

  const candidates: DepartureCandidate[] = [];
  const maxIdx = Math.min(hourly.length - 1, horizonHours);
  for (let idx = 0; idx <= maxIdx; idx += stepHours) {
    const h = hourOf(hourly[idx].time);
    const dl = daylightHours(dateOf(hourly[idx].time), location);
    if (daylightOnly && (h < dl.sunriseHour || h > dl.sunsetHour - 2)) {
      continue;
    }
    candidates.push(
      simulate(
        course, totalNm, hourly, idx, polar, cfg, surge, thresholds, propulsion, cruiseKt, location,
      ),
    );
  }

  // `best` = la salida recomendada (menor costo: nivel + tiempo + penalizaciones);
  // ante igual costo gana la más temprana. `ranked` se muestra en orden
  // CRONOLÓGICO (por hora de salida), no por costo.
  const best =
    [...candidates].sort(
      (a, b) => a.cost - b.cost || a.departAt.localeCompare(b.departAt),
    )[0] ?? null;
  const ranked = candidates.sort((a, b) => a.departAt.localeCompare(b.departAt));
  return {
    routeId: route.id,
    routeName: route.name,
    best,
    ranked,
    computedAt: hourly[0]?.time ?? '',
  };
}
