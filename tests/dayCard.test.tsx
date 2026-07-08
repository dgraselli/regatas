import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DayCard } from '@/components/dashboard/DayCard';
import { scoringFor } from '@/lib/config/boat';
import type { DayScore } from '@/lib/types/forecast';

const t = scoringFor('normal'); // fogYellowM 4000, fogRedM 1000

function makeDay(overrides: Partial<DayScore> = {}): DayScore {
  return {
    date: '2026-07-10',
    level: 'verde',
    condition: 'soleado',
    reasons: [],
    metrics: {
      windMedianKt: 10,
      gustPeakKt: 15,
      windDirDominant: 270,
      precipTotalMm: 0,
      tempMinC: 12,
      tempMaxC: 20,
      ...overrides.metrics,
    },
    ...overrides,
  };
}

function renderCard(day: DayScore) {
  return render(
    <DayCard
      day={day}
      selected={false}
      onSelect={() => {}}
      fogYellowM={t.fogYellowM}
      fogRedM={t.fogRedM}
    />,
  );
}

describe('DayCard — niebla', () => {
  it('sin niebla: no muestra ícono ni visibilidad', () => {
    renderCard(makeDay({ metrics: { visibilityMinM: 20000 } as DayScore['metrics'] }));
    expect(screen.queryByLabelText('Niebla')).toBeNull();
    expect(screen.queryByLabelText('Neblina')).toBeNull();
    expect(screen.queryByText(/\d+ m$|km$/)).toBeNull();
  });

  it('niebla cerrada: muestra el ícono de niebla y la visibilidad en metros', () => {
    renderCard(makeDay({ metrics: { visibilityMinM: 500 } as DayScore['metrics'] }));
    // Ícono de niebla (SVG con aria-label) presente.
    expect(screen.getByLabelText('Niebla')).toBeDefined();
    // Visibilidad legible en metros (< 1 km).
    expect(screen.getByText('500 m')).toBeDefined();
  });

  it('neblina liviana: ícono de neblina y visibilidad en km', () => {
    renderCard(makeDay({ metrics: { visibilityMinM: 3000 } as DayScore['metrics'] }));
    expect(screen.getByText('3.0 km')).toBeDefined();
    expect(screen.getByLabelText('Neblina')).toBeDefined();
  });

  it('respeta partialFog aunque la visibilidad mínima sea del rango de neblina', () => {
    renderCard(
      makeDay({
        partialFog: { dense: true, when: 'manana' },
        metrics: { visibilityMinM: 2000 } as DayScore['metrics'],
      }),
    );
    expect(screen.getByLabelText('Niebla')).toBeDefined();
  });
});
