import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TideSummary } from '@/components/dashboard/TideSummary';
import type { WaterLevelStatus } from '@/lib/types/water';
import type { HourlyPoint } from '@/lib/types/forecast';

// Hora fija: 2026-09-03 19:43 en Buenos Aires. Las observaciones del INA llegan
// como texto naive en esa zona, así que el cálculo se hace contra este "ahora".
const NOW = new Date('2026-09-03T22:43:00Z');

function statusAt(lastLocalTime: string): WaterLevelStatus {
  return {
    stationName: 'La Plata (INA)',
    observations: [
      { time: '2026-09-03T11:45', heightM: 1.1 },
      { time: lastLocalTime, heightM: 1.2 },
    ],
    trend: 'subiendo',
    fetchedAt: NOW.toISOString(), // recién: si la antigüedad saliera de acá, diría "recién"
  };
}

/** El texto queda partido en varios nodos por el JSX; se compara el todo. */
function textOf(lastLocalTime: string): string {
  const { container } = render(<TideSummary status={statusAt(lastLocalTime)} surge={[]} />);
  return container.textContent ?? '';
}

describe('TideSummary — antigüedad del nivel observado', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  it('muestra hace cuánto se MIDIÓ el nivel, no hace cuánto lo bajamos', () => {
    // Medido a las 17:45 → 2 h antes del ahora, aunque `fetchedAt` sea de recién.
    expect(textOf('2026-09-03T17:45')).toContain('observado hace 2 h');
  });

  it('no avisa nada mientras el atraso sea el normal del INA (~1-2 h)', () => {
    expect(textOf('2026-09-03T18:45')).not.toContain('Último dato');
  });

  it('marca en ámbar cuando el dato pasa las 3 h, sin gritar que está caída', () => {
    const t = textOf('2026-09-03T15:45'); // 3 h 58 min
    expect(t).toContain('⚠️');
    expect(t).toContain('observado hace 4 h');
    // Una demora larga no es lo mismo que una estación caída.
    expect(t).not.toContain('puede estar caída');
  });

  it('a partir de 6 h sí sugiere que la estación está caída', () => {
    expect(textOf('2026-09-03T12:45')).toContain('la estación puede estar caída');
  });

  it('redondea la antigüedad en vez de truncarla', () => {
    // 1 h 58 min: con `floor` decía "hace 1 h" y disimulaba casi una hora.
    expect(textOf('2026-09-03T17:45')).toContain('hace 2 h');
  });
});

/** Pronóstico horario con solo el nivel del mar, que es lo que usa la ventana. */
function hourly(from: string, levels: number[]): HourlyPoint[] {
  const base = Date.parse(`${from}:00Z`);
  return levels.map((seaLevelM, i) => ({
    time: `${new Date(base + i * 3_600_000).toISOString().slice(0, 13)}:00`,
    windKt: 8,
    gustKt: 12,
    windDir: 90,
    precipMm: 0,
    tempC: 15,
    seaLevelM,
  }));
}

describe('TideSummary — banda de incertidumbre y ventana de salida', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW })); // 2026-09-03 19:43 local
  afterEach(() => vi.useRealTimers());

  const medido = statusAt('2026-09-03T17:45'); // 1.20 m, 2 h de atraso

  it('muestra el nivel con su margen de error, no como un número exacto', () => {
    const { container } = render(<TideSummary status={medido} surge={[]} />);
    expect(container.textContent).toMatch(/1\.\d\d m± 0\.\d\d/);
  });

  it('admite que no sabe cuando el margen cruza el umbral de la amarra', () => {
    // Nivel ~1.20 con banda ±0.22 y mínimo en 1.10: el borde inferior lo cruza.
    const { container } = render(
      <TideSummary status={medido} surge={[]} safeMinM={1.1} />,
    );
    expect(container.textContent).toContain('no puedo asegurarte de qué lado está');
  });

  it('da un veredicto firme cuando el margen NO llega al umbral', () => {
    const { container } = render(
      <TideSummary status={medido} surge={[]} safeMinM={0.5} />,
    );
    expect(container.textContent).toContain('Dentro de tu rango seguro');
    expect(container.textContent).not.toContain('no puedo asegurarte');
  });

  it('dice hasta qué hora se puede salir usando el pronóstico de nivel', () => {
    // Mareógrafo en 1.20 y pronóstico en 1.20 a esa hora → offset 0. Después baja.
    const fc = hourly('2026-09-03T15', [1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 0.9, 0.6, 0.3, 0.3, 0.6, 1.2]);
    const { container } = render(
      <TideSummary status={medido} hourly={fc} surge={[]} safeMinM={0.5} />,
    );
    expect(container.textContent).toMatch(/Podés salir hasta las \d\d:\d\d/);
  });

  it('sin pronóstico de nivel no inventa ninguna ventana', () => {
    const { container } = render(
      <TideSummary status={medido} surge={[]} safeMinM={0.5} />,
    );
    expect(container.textContent).not.toContain('Podés salir');
  });
});
