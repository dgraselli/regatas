import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetodologiaPanel } from '@/components/dashboard/MetodologiaPanel';
import { scoringFor } from '@/lib/config/boat';

describe('MetodologiaPanel', () => {
  it('explica la fuente de datos (Open-Meteo)', () => {
    render(<MetodologiaPanel />);
    expect(screen.getAllByText(/Open-Meteo/).length).toBeGreaterThan(0);
  });

  it('muestra los umbrales reales del scoring según la tolerancia', () => {
    render(<MetodologiaPanel caution="prudente" />);
    const t = scoringFor('prudente');
    // Umbrales salen del config, no hardcodeados en el texto.
    expect(screen.getByText(new RegExp(`${t.dangerWind} kt`))).toBeDefined();
    expect(screen.getByText(new RegExp(`${t.gustRed} kt`))).toBeDefined();
    expect(screen.getByText(/Verde/)).toBeDefined();
    expect(screen.getByText(/Rojo/)).toBeDefined();
  });
});
