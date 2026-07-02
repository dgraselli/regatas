import type { HourlyPoint, DayScore, TrafficLevel, SkyCondition } from '@/lib/types/forecast';
import type { ScoringThresholds, Propulsion } from '@/lib/types/config';
import type { SurgeAlert } from '@/lib/types/water';
import { SCORING, DAYLIGHT } from '@/lib/config/boat';

/**
 * Horas de luz despejadas que deben quedar antes o DESPUÉS de la niebla para
 * considerar que el día sigue siendo navegable (saliendo más tarde / más temprano).
 * Si queda al menos esa ventana, la niebla no marca el día como "no recomendable".
 */
const FOG_NAVIGABLE_WINDOW_H = 4;

/**
 * La niebla CERRADA (densa) que dura más de estas horas degrada el día a precaución
 * aunque despeje: tantas horas de visibilidad muy baja son riesgo suficiente. La
 * niebla densa más corta o la neblina liviana se marcan como "temporal" sin degradar.
 */
const FOG_PRECAUTION_MIN_H = 2;

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

/** mm por hora a partir de los cuales se cuenta una hora como "con lluvia". */
const PRECIP_HOUR_MM = 0.2;

/**
 * Condición del cielo del día (para el ícono de la tarjeta), a partir de las
 * horas de luz: primero la lluvia (parcial/total según cuántas horas llueve) y,
 * si está seco, la nubosidad media. Devuelve undefined si no hay dato de nubes
 * y no llueve (no podemos distinguir soleado de nublado).
 */
function skyCondition(hours: HourlyPoint[]): SkyCondition | undefined {
  if (hours.length === 0) return undefined;
  const precipHours = hours.filter((p) => p.precipMm >= PRECIP_HOUR_MM).length;
  if (precipHours / hours.length >= 0.5) return 'lluvia';
  if (precipHours > 0) return 'lluvia-parcial';

  const clouds = hours.map((p) => p.cloudCoverPct).filter((v): v is number => v != null);
  if (clouds.length === 0) return undefined;
  const avg = clouds.reduce((s, c) => s + c, 0) / clouds.length;
  if (avg < 30) return 'soleado';
  if (avg < 70) return 'parcial';
  return 'nublado';
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
  propulsion: Propulsion = 'vela',
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
  const waveVals = usable
    .map((p) => p.waveHeightM)
    .filter((v): v is number => v != null);
  const waveMaxM = waveVals.length
    ? Math.round(Math.max(...waveVals) * 10) / 10
    : undefined;
  const temps = points.map((p) => p.tempC);
  const tempMinC = Math.round(Math.min(...temps));
  const tempMaxC = Math.round(Math.max(...temps));

  const reasons: string[] = [];
  let level: TrafficLevel = 'verde';
  let partialFog: DayScore['partialFog'];

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
  // todo el día. Reglas:
  //  - Sin ventana navegable (cubre toda la jornada): niebla densa => peligro;
  //    neblina liviana => precaución.
  //  - Con ventana navegable, pero niebla CERRADA que dura más de 2 h => precaución
  //    igual (son demasiadas horas de visibilidad muy baja).
  //  - Con ventana navegable y niebla densa corta (≤2 h) o neblina liviana => NO
  //    degrada; se marca como "temporal" (a primera hora / por la tarde).
  // El pronóstico de niebla es poco confiable; siempre se comunica como "posible".
  const foggy = usable.filter(
    (p) => p.visibilityM != null && p.visibilityM <= thresholds.fogYellowM,
  );
  if (foggy.length > 0) {
    const minVis = Math.round(Math.min(...foggy.map((p) => p.visibilityM as number)));
    const dense = minVis <= thresholds.fogRedM; // niebla cerrada, no solo neblina
    const durationH = foggy.length; // horas de luz con visibilidad reducida
    const firstFoggyHour = Math.min(...foggy.map((p) => hourOf(p.time)));
    const lastFoggyHour = Math.max(...foggy.map((p) => hourOf(p.time)));
    const morning = firstFoggyHour < 12;
    const cuando = morning ? 'a primera hora' : 'por la tarde';
    const isClear = (p: HourlyPoint) =>
      p.visibilityM == null || p.visibilityM > thresholds.fogYellowM;
    const clearHoursAfter = usable.filter(
      (p) => hourOf(p.time) > lastFoggyHour && isClear(p),
    ).length;
    const clearHoursBefore = usable.filter(
      (p) => hourOf(p.time) < firstFoggyHour && isClear(p),
    ).length;
    const hasNavigableWindow =
      clearHoursAfter >= FOG_NAVIGABLE_WINDOW_H ||
      clearHoursBefore >= FOG_NAVIGABLE_WINDOW_H;

    if (!hasNavigableWindow) {
      if (dense) {
        escalate('rojo', `Niebla buena parte del día (visibilidad mín ${formatVis(minVis)})`);
      } else {
        escalate('amarillo', `Visibilidad reducida (${formatVis(minVis)}, posible neblina)`);
      }
    } else if (dense && durationH > FOG_PRECAUTION_MIN_H) {
      // Niebla cerrada de varias horas: aunque despeje, baja a precaución.
      escalate(
        'amarillo',
        `Niebla ${cuando} (visibilidad mín ${formatVis(minVis)}, ${durationH} h); ${
          morning ? `despeja ~${lastFoggyHour + 1}h` : `desde ~${firstFoggyHour}h`
        }`,
      );
    } else {
      // Niebla densa corta o neblina liviana que despeja: no degrada el día.
      partialFog = { dense, when: morning ? 'manana' : 'tarde' };
      const desc = dense ? 'Niebla' : 'Neblina';
      reasons.push(
        morning
          ? `${desc} temporal a primera hora (visibilidad mín ${formatVis(minVis)}); despeja ~${lastFoggyHour + 1}h, navegable después`
          : `${desc} temporal por la tarde (visibilidad mín ${formatVis(minVis)}); navegable hasta ~${firstFoggyHour}h`,
      );
    }
  }

  // Olas (altura significativa). Afecta a vela y motor por igual. La grilla marina
  // es gruesa y no resuelve bien la costa del estuario, así que es orientativo.
  if (waveMaxM != null) {
    if (waveMaxM >= thresholds.waveRedM) {
      escalate('rojo', `Olas grandes (~${waveMaxM.toFixed(1)} m)`);
    } else if (waveMaxM >= thresholds.waveYellowM) {
      escalate('amarillo', `Olas moderadas (~${waveMaxM.toFixed(1)} m)`);
    }
  }

  // Surge meteorológico
  for (const alert of surgeOnDay) {
    const to: TrafficLevel = alert.severity >= 2 ? 'rojo' : 'amarillo';
    escalate(to, alert.message);
  }

  // Poco viento: no es peligro, es que probablemente no se pueda navegar a vela.
  // Solo aplica si no hay otras precauciones/peligros (esos tienen prioridad) y
  // solo a VELA: a motor el poco viento (agua tranquila) es justo lo ideal.
  if (propulsion === 'vela' && level === 'verde' && windMedianKt < thresholds.idealWindMin) {
    level = 'poco-viento';
    reasons.push(`Poco viento (~${windMedianKt} kt)`);
  }

  if (level === 'verde' && reasons.length === 0) {
    reasons.push(
      propulsion === 'motor' && windMedianKt < thresholds.idealWindMin
        ? `Agua tranquila (~${windMedianKt} kt), buen día para motor`
        : `Buenas condiciones (~${windMedianKt} kt, sin lluvia)`,
    );
  }

  return {
    date,
    level,
    condition: skyCondition(usable),
    partialFog,
    reasons,
    metrics: {
      windMedianKt,
      gustPeakKt,
      windDirDominant,
      precipTotalMm,
      tempMinC,
      tempMaxC,
      visibilityMinM,
      waveMaxM,
    },
  };
}

/** Califica todos los días presentes en el pronóstico horario. */
export function scoreDays(
  hourly: HourlyPoint[],
  thresholds: ScoringThresholds = SCORING,
  surgeAlerts: SurgeAlert[] = [],
  propulsion: Propulsion = 'vela',
): DayScore[] {
  const byDay = groupByDay(hourly);
  const days: DayScore[] = [];
  for (const [date, points] of byDay) {
    const surgeOnDay = surgeAlerts.filter(
      (a) => dateOf(a.startsAt) <= date && dateOf(a.endsAt) >= date,
    );
    days.push(scoreDay(date, points, thresholds, surgeOnDay, propulsion));
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}
