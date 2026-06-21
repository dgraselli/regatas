import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetodologiaInfo } from '@/components/alerts/MetodologiaInfo';
import { SURGE } from '@/lib/config/boat';

describe('MetodologiaInfo', () => {
  it('explica las fuentes de datos (Open-Meteo e INA)', () => {
    render(<MetodologiaInfo />);
    expect(screen.getAllByText(/Open-Meteo/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sistema de Alerta Hidrológico/i)).toBeDefined();
  });

  it('muestra los umbrales reales de SURGE', () => {
    render(<MetodologiaInfo />);
    // Viento mínimo y persistencia salen del config, no hardcodeados en el texto.
    expect(screen.getByText(new RegExp(`${SURGE.minWindKt} kt`))).toBeDefined();
    expect(screen.getByText(new RegExp(`${SURGE.minHours} horas`))).toBeDefined();
    expect(screen.getByText(/Sudestada/)).toBeDefined();
    expect(screen.getByText(/Bajante/)).toBeDefined();
  });

  it('nombra la estación cuando se le pasa', () => {
    render(<MetodologiaInfo stationName="La Plata (INA)" />);
    expect(screen.getByText(/La Plata \(INA\)/)).toBeDefined();
  });
});
