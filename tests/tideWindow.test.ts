import { describe, it, expect } from 'vitest';
import {
  buildTideWindow,
  uncertaintyAt,
  tideRate,
  UNCERTAINTY_NOW_M,
  UNCERTAINTY_12H_M,
} from '@/lib/domain/tideWindow';
import type { HourlyPoint } from '@/lib/types/forecast';
import type { WaterLevelObservation } from '@/lib/types/water';

const NOW = '2026-09-04T14:00';

/** Pronóstico horario mínimo: solo importa `seaLevelM`. */
function hourly(from: string, levels: (number | undefined)[]): HourlyPoint[] {
  const base = Date.parse(`${from}:00Z`);
  return levels.map((seaLevelM, i) => ({
    time: `${new Date(base + i * 3_600_000).toISOString().slice(0, 13)}:00`,
    windKt: 10,
    gustKt: 15,
    windDir: 180,
    precipMm: 0,
    tempC: 18,
    seaLevelM,
  }));
}

function obs(from: string, heights: number[]): WaterLevelObservation[] {
  const base = Date.parse(`${from}:00Z`);
  return heights.map((heightM, i) => ({
    // El INA mide a :45, no en la hora en punto.
    time: `${new Date(base + i * 3_600_000).toISOString().slice(0, 13)}:45`,
    heightM,
  }));
}

describe('uncertaintyAt', () => {
  it('crece con el horizonte y se aplana en los extremos', () => {
    expect(uncertaintyAt(0)).toBeCloseTo(UNCERTAINTY_NOW_M);
    expect(uncertaintyAt(12)).toBeCloseTo(UNCERTAINTY_12H_M);
    expect(uncertaintyAt(6)).toBeCloseTo((UNCERTAINTY_NOW_M + UNCERTAINTY_12H_M) / 2);
    // El pasado y lo que excede el horizonte no achican ni agrandan la banda.
    expect(uncertaintyAt(-3)).toBeCloseTo(UNCERTAINTY_NOW_M);
    expect(uncertaintyAt(48)).toBeCloseTo(UNCERTAINTY_12H_M);
  });
});

describe('buildTideWindow — anclaje del pronóstico', () => {
  it('reancla el pronóstico al cero del mareógrafo con las últimas mediciones', () => {
    // Pronóstico (MSL) constante en 0.10; mareógrafo constante en 1.00 → offset 0.90.
    const w = buildTideWindow(
      obs('2026-09-04T09', [1, 1, 1]), // 09:45, 10:45, 11:45
      hourly('2026-09-04T08', Array(20).fill(0.1)),
      NOW,
    );
    expect(w.offsetM).toBeCloseTo(0.9, 6);
    expect(w.now?.heightM).toBeCloseTo(1.0, 6);
    expect(w.now?.source).toBe('puente');
  });

  it('sigue al pronóstico hacia adelante, no arrastra el último valor', () => {
    // El nivel medido está plano en 1.00 pero el pronóstico baja 0.2 m por hora.
    const w = buildTideWindow(
      obs('2026-09-04T11', [1, 1, 1]), // hasta 13:45 → horas 12, 13 y 14
      // 10h..17h: plano en 0.50 mientras dura la medición, después baja.
      hourly('2026-09-04T10', [0.5, 0.5, 0.5, 0.5, 0.5, 0.3, 0.1, -0.1]),
      NOW,
    );
    expect(w.offsetM).toBeCloseTo(0.5, 6);
    // A las 17:00 el pronóstico da -0.10, que reanclado es 0.40: la estimación
    // baja aunque la última medición dijera 1.00.
    const a17 = w.points.find((p) => p.time === '2026-09-04T17:00');
    expect(a17?.heightM).toBeCloseTo(0.4, 6);
    expect(a17?.source).toBe('puente');
  });

  it('marca como medidas las horas que tienen observación real', () => {
    const w = buildTideWindow(
      obs('2026-09-04T11', [1.1, 1.2, 1.3]),
      hourly('2026-09-04T10', Array(10).fill(0.5)),
      NOW,
    );
    const medidos = w.points.filter((p) => p.source === 'medido');
    expect(medidos.map((p) => p.heightM)).toEqual([1.1, 1.2, 1.3]);
    // Una medición no lleva banda: es el valor real, no una estimación.
    expect(medidos.every((p) => p.uncertaintyM === 0)).toBe(true);
  });

  it('cae en persistencia si no hay nivel del mar para anclar', () => {
    const w = buildTideWindow(
      obs('2026-09-04T10', [1.1, 1.2, 1.3]), // última: 12:45 → hora 13:00
      hourly('2026-09-04T10', Array(10).fill(undefined)),
      NOW,
    );
    expect(w.offsetM).toBeNull();
    expect(w.now?.source).toBe('persistencia');
    expect(w.now?.heightM).toBeCloseTo(1.3, 6);
    // El dato es de una hora antes: se arrastra, pero con banda.
    expect(w.now?.uncertaintyM).toBeGreaterThan(0);
  });

  it('devuelve vacío sin observaciones', () => {
    expect(buildTideWindow([], hourly('2026-09-04T10', [0.5]), NOW).points).toEqual([]);
  });
});

describe('buildTideWindow — ventana segura', () => {
  // Marea que baja de 1.20 a 0.20 entre las 14 y las 19, y vuelve a subir.
  const bajante = hourly('2026-09-04T12', [1.2, 1.2, 1.2, 1.0, 0.8, 0.6, 0.4, 0.2, 0.4, 0.8, 1.2]);
  const medido = obs('2026-09-04T11', [1.2, 1.2, 1.2]); // offset 0

  it('avisa a partir de qué hora el nivel queda por debajo del mínimo', () => {
    const w = buildTideWindow(medido, bajante, NOW, { safeMinM: 0.5 });
    const bajo = w.unsafe.find((s) => s.kind === 'bajo');
    // El valor central cruza 0.50 entre las 17 (0.60) y las 18 (0.40); el borde
    // pesimista lo adelanta a las 17 en punto (0.60 - 0.225 = 0.375).
    expect(bajo?.startsAt).toBe('2026-09-04T17:00');
    expect(bajo?.endsAt).toBe('2026-09-04T21:00');
  });

  it('no inventa tramos si el nivel nunca se acerca al umbral', () => {
    expect(buildTideWindow(medido, bajante, NOW, { safeMinM: -2 }).unsafe).toEqual([]);
  });

  it('no mira hacia atrás: la ventana arranca en el ahora', () => {
    const w = buildTideWindow(medido, bajante, NOW, { safeMinM: 0.5 });
    expect(w.unsafe.every((s) => s.startsAt >= NOW)).toBe(true);
  });

  it('deja el tramo abierto si sigue fuera de rango al final del horizonte', () => {
    const w = buildTideWindow(medido, bajante, NOW, { safeMinM: 5 });
    expect(w.unsafe).toHaveLength(1);
    expect(w.unsafe[0].endsAt).toBeNull();
  });

  it('detecta agua alta contra el máximo seguro', () => {
    const w = buildTideWindow(medido, bajante, NOW, { safeMaxM: 1.3 });
    // A las 14 hay medición (1.20 exacto, sin banda) → no dispara. Recién a las
    // 22, ya estimado, el borde superior (1.20 + 0.23) toca el máximo.
    expect(w.unsafe[0]).toMatchObject({ kind: 'alto', startsAt: '2026-09-04T22:00' });
  });

  it('cierra el tramo anterior al pasar directo de poca agua a agua alta', () => {
    // Sube de golpe: 0.20 → 2.00 sin pasar por el rango cómodo.
    const salto = hourly('2026-09-04T12', [1, 1, 1, 0.2, 0.2, 2, 2, 2, 2, 2, 2]);
    const w = buildTideWindow(obs('2026-09-04T11', [1, 1, 1]), salto, NOW, {
      safeMinM: 0.6,
      safeMaxM: 1.5,
    });
    expect(w.unsafe.map((s) => s.kind)).toEqual(['bajo', 'alto']);
    // El tramo bajo no puede quedar abierto solo porque lo siguió otro tramo.
    expect(w.unsafe[0].endsAt).toBe(w.unsafe[1].startsAt);
  });

  it('une dos tramos malos separados por una sola hora', () => {
    // Toca el mínimo, se despega una hora justa, y vuelve a tocarlo.
    const dientes = hourly('2026-09-04T12', [1, 1, 1, 0.3, 0.3, 1.5, 0.3, 0.3, 1, 1, 1]);
    const w = buildTideWindow(obs('2026-09-04T11', [1, 1, 1]), dientes, NOW, { safeMinM: 0.6 });
    expect(w.unsafe).toHaveLength(1);
    expect(w.unsafe[0]).toMatchObject({ startsAt: '2026-09-04T15:00', endsAt: '2026-09-04T20:00' });
  });

  it('no une tramos separados por una pausa de verdad', () => {
    const pausa = hourly('2026-09-04T12', [1, 1, 1, 0.3, 1.5, 1.5, 1.5, 0.3, 1, 1, 1]);
    const w = buildTideWindow(obs('2026-09-04T11', [1, 1, 1]), pausa, NOW, { safeMinM: 0.6 });
    expect(w.unsafe).toHaveLength(2);
  });

  it('sin umbrales definidos no evalúa nada', () => {
    expect(buildTideWindow(medido, bajante, NOW).unsafe).toEqual([]);
  });
});

describe('tideRate — corriente de marea a partir del nivel medido', () => {
  it('sube → entrando, con la velocidad en cm/h', () => {
    // 1.00 → 1.30 en 2 h = 15 cm/h.
    const r = tideRate(obs('2026-09-04T11', [1.0, 1.15, 1.3]));
    expect(r?.stream).toBe('entrando');
    expect(r?.cmPerH).toBeCloseTo(15, 6);
  });

  it('baja → saliendo, con signo negativo', () => {
    const r = tideRate(obs('2026-09-04T11', [1.3, 1.15, 1.0]));
    expect(r?.stream).toBe('saliendo');
    expect(r?.cmPerH).toBeCloseTo(-15, 6);
  });

  it('cerca del cambio de marea dice parada, sin inventar un sentido', () => {
    // 2 cm en 2 h = 1 cm/h: por debajo del umbral, el signo no significa nada.
    const r = tideRate(obs('2026-09-04T11', [1.0, 1.01, 1.02]));
    expect(r?.stream).toBe('parada');
  });

  it('usa sólo la ventana pedida, no toda la serie', () => {
    // 6 h de serie, pero la ventana son las últimas 2 h: 1.20 → 1.40 = 10 cm/h.
    const r = tideRate(obs('2026-09-04T08', [0.2, 0.5, 0.9, 1.1, 1.2, 1.3, 1.4]));
    expect(r?.cmPerH).toBeCloseTo(10, 6);
  });

  it('devuelve null si la estación tuvo un hueco y no hay dato en la ventana', () => {
    const viejo = obs('2026-09-04T02', [1.0, 1.1]); // 02:45 y 03:45
    const reciente = { time: '2026-09-04T13:45', heightM: 1.9 }; // 10 h después
    expect(tideRate([...viejo, reciente])).toBeNull();
  });

  it('devuelve null sin suficientes mediciones', () => {
    expect(tideRate([])).toBeNull();
    expect(tideRate(obs('2026-09-04T11', [1.0]))).toBeNull();
  });
});
