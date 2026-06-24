import type { HourlyPoint, DayScore, TrafficLevel } from '@/lib/types/forecast';
import type { ScoringThresholds } from '@/lib/types/config';
import type { SurgeAlert } from '@/lib/types/water';
import { SCORING, DAYLIGHT } from '@/lib/config/boat';

/**
 * Horas de luz despejadas que deben quedar DESPUÉS de la niebla para considerar
 * que el día sigue siendo navegable (saliendo más tarde). Si quedan al menos
 * tantas, la niebla matinal no marca el día como "no recomendable".
 */
const FOG_NAVIGABLE_WINDOW_H = 4;

function hourOf(iso: string): number {
  // iso local 'YYYY-MM-DDTHH:mm' -> HH
  return Number(iso.slice(11, 13));
}

function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Visibilidad legible: metros por debajo de 1 km, km con un decimal por encima. */
function formatVis(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Media circular de direcciones (grados), resultado en 0..360. */
function circularMean(degs: number[]): number {
  if (degs.length === 0) return 0;
  let x = 0;
  let y = 0;
  for (const d of degs) {
    x += Math.cos((d * Math.PI) / 180);
    y += Math.sin((d * Math.PI) / 180);
  }
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function groupByDay(hourly: HourlyPoint[]): Map<string, HourlyPoint[]> {
  const map = new Map<string, HourlyPoint[]>();
  for (const p of hourly) {
    const d = dateOf(p.time);
    const arr = map.get(d) ?? [];
    arr.push(p);
    map.set(d, arr);
  }
  return map;
}

/**
 * Califica un único día a partir de sus puntos horarios.
 * Considera solo horas de luz para viento/ráfagas. Una alerta de surge activa
 * ese día degrada el nivel.
 */
export function scoreDay(
  date: string,
  points: HourlyPoint[],
  thresholds: ScoringThresholds = SCORING,
  surgeOnDay: SurgeAlert[] = [],
): DayScore {
  const daylight = points.filter(
    (p) => hourOf(p.time) >= DAYLIGHT.sunriseHour && hourOf(p.time) <= DAYLIGHT.sunsetHour,
  );
  const usable = daylight.length ? daylight : points;

  const windMedianKt = Math.round(median(usable.map((p) => p.windKt)));
  const gustPeakKt = Math.round(Math.max(0, ...usable.map((p) => p.gustKt)));
  const windDirDominant = Math.round(circularMean(usable.map((p) => p.windDir)));
  const precipTotalMm = Math.round(usable.reduce((s, p) => s + p.precipMm, 0) * 10) / 10;
  const visVals = usable
    .map((p) => p.visibilityM)
    .filter((v): v is number => v != null);
  const visibilityMinM = visVals.length ? Math.round(Math.min(...visVals)) : undefined;
  const temps = points.map((p) => p.tempC);
  const tempMinC = Math.round(Math.min(...temps));
  const tempMaxC = Math.round(Math.max(...temps));

  const reasons: string[] = [];
  let level: TrafficLevel = 'verde';

  const escalate = (to: TrafficLevel, reason: string) => {
    reasons.push(reason);
    const order: TrafficLevel[] = ['verde', 'amarillo', 'rojo'];
    if (order.indexOf(to) > order.indexOf(level)) level = to;
  };

  // Viento (fuerte = precaución / peligro). El viento flojo se trata aparte abajo.
  if (windMedianKt >= thresholds.dangerWind) {
    escalate('rojo', `Viento muy fuerte (~${windMedianKt} kt)`);
  } else if (windMedianKt >= thresholds.strongWind) {
    escalate('amarillo', `Viento fuerte (~${windMedianKt} kt)`);
  }

  // Ráfagas
  if (gustPeakKt >= thresholds.gustRed) {
    escalate('rojo', `Ráfagas peligrosas (hasta ${gustPeakKt} kt)`);
  } else if (gustPeakKt >= thresholds.gustYellow) {
    escalate('amarillo', `Ráfagas marcadas (hasta ${gustPeakKt} kt)`);
  }

  // Lluvia
  if (precipTotalMm >= thresholds.rainRed) {
    escalate('rojo', `Lluvia fuerte (${precipTotalMm} mm)`);
  } else if (precipTotalMm >= thresholds.rainYellow) {
    escalate('amarillo', `Algo de lluvia (${precipTotalMm} mm)`);
  }

  // Niebla / visibilidad reducida. Es un problema de HORARIO más que un peligro de
  // todo el día: si despeja temprano y queda una ventana navegable después, el día
  // baja solo a precaución (con el horario en la nota), no a "no recomendable".
  // El pronóstico de niebla es poco confiable; siempre se comunica como "posible".
  const foggy = usable.filter(
    (p) => p.visibilityM != null && p.visibilityM <= thresholds.fogYellowM,
  );
  if (foggy.length > 0) {
    const minVis = Math.round(Math.min(...foggy.map((p) => p.visibilityM as number)));
    const dense = minVis <= thresholds.fogRedM; // niebla, no solo neblina
    const lastFoggyHour = Math.max(...foggy.map((p) => hourOf(p.time)));
    const clearHoursAfter = usable.filter(
      (p) =>
        hourOf(p.time) > lastFoggyHour &&
        (p.visibilityM == null || p.visibilityM > thresholds.fogYellowM),
    ).length;
    const clearsEarly = clearHoursAfter >= FOG_NAVIGABLE_WINDOW_H;

    if (clearsEarly) {
      const desc = dense ? 'Niebla a primera hora' : 'Visibilidad reducida temprano';
      escalate(
        'amarillo',
        `${desc} (visibilidad mín ${formatVis(minVis)}); despeja ~${lastFoggyHour + 1}h, navegable después`,
      );
    } else if (dense) {
      escalate('rojo', `Niebla buena parte del día (visibilidad mín ${formatVis(minVis)})`);
    } else {
      escalate('amarillo', `Visibilidad reducida (${formatVis(minVis)}, posible neblina)`);
    }
  }

  // Surge meteorológico
  for (const alert of surgeOnDay) {
    const to: TrafficLevel = alert.severity >= 2 ? 'rojo' : 'amarillo';
    escalate(to, alert.message);
  }

  // Poco viento: no es peligro, es que probablemente no se pueda navegar a vela.
  // Solo aplica si no hay otras precauciones/peligros (esos tienen prioridad).
  if (level === 'verde' && windMedianKt < thresholds.idealWindMin) {
    level = 'poco-viento';
    reasons.push(`Poco viento (~${windMedianKt} kt)`);
  }

  if (level === 'verde' && reasons.length === 0) {
    reasons.push(`Buenas condiciones (~${windMedianKt} kt, sin lluvia)`);
  }

  return {
    date,
    level,
    reasons,
    metrics: {
      windMedianKt,
      gustPeakKt,
      windDirDominant,
      precipTotalMm,
      tempMinC,
      tempMaxC,
      visibilityMinM,
    },
  };
}

/** Califica todos los días presentes en el pronóstico horario. */
export function scoreDays(
  hourly: HourlyPoint[],
  thresholds: ScoringThresholds = SCORING,
  surgeAlerts: SurgeAlert[] = [],
): DayScore[] {
  const byDay = groupByDay(hourly);
  const days: DayScore[] = [];
  for (const [date, points] of byDay) {
    const surgeOnDay = surgeAlerts.filter(
      (a) => dateOf(a.startsAt) <= date && dateOf(a.endsAt) >= date,
    );
    days.push(scoreDay(date, points, thresholds, surgeOnDay));
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}
