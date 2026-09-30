import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetodologiaInfo } from '@/components/alerts/MetodologiaInfo';
import { SURGE } from '@/lib/config/boat';
import { UNCERTAINTY_NOW_M, UNCERTAINTY_12H_M } from '@/lib/domain/tideWindow';
import { OBSERVED_STALE_MS, OBSERVED_SEVERE_MS } from '@/lib/hooks/useFreshness';

describe('MetodologiaInfo', () => {
  it('explica las fuentes de datos (Open-Meteo e INA)', () => {
    render(<MetodologiaInfo />);
    expect(screen.getAllByText(/Open-Meteo/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sistema de Alerta Hidrológico/i)).toBeDefined();
  });

  it('muestra los umbrales reales de SURGE', () => {
    const { container } = render(<MetodologiaInfo />);
    // Los umbrales salen del config, no hardcodeados en el texto.
    const text = container.textContent ?? '';
    expect(text).toContain(`${SURGE.seaLevelHighM.toFixed(2)} m`);
    expect(text).toContain(`${SURGE.seaLevelLowM.toFixed(2)} m`);
    expect(text).toContain(`≥ ${SURGE.minWindKt} kt`);
    expect(text).toMatch(/sudestada/i);
    expect(text).toMatch(/bajante/i);
  });

  it('nombra la estación cuando se le pasa', () => {
    render(<MetodologiaInfo stationName="La Plata (INA)" />);
    expect(screen.getByText(/La Plata \(INA\)/)).toBeDefined();
  });

  it('distingue lo medido de lo estimado y avisa del atraso de cada fuente', () => {
    const { container } = render(<MetodologiaInfo />);
    const t = container.textContent ?? '';
    expect(t).toContain('menos de 1 h');
    expect(t).toContain('1 a 2 h de atraso');
    expect(t).toMatch(/línea llena/);
    expect(t).toMatch(/reancla/);
  });

  it('muestra la banda de incertidumbre real, no un número escrito a mano', () => {
    const { container } = render(<MetodologiaInfo />);
    const t = container.textContent ?? '';
    expect(t).toContain(`±${UNCERTAINTY_NOW_M.toFixed(2)} m`);
    expect(t).toContain(`±${UNCERTAINTY_12H_M.toFixed(2)} m`);
  });

  it('publica los umbrales de antigüedad que usa el código', () => {
    const { container } = render(<MetodologiaInfo />);
    const t = container.textContent ?? '';
    expect(t).toContain(`${OBSERVED_STALE_MS / 3_600_000} h`);
    expect(t).toContain(`${OBSERVED_SEVERE_MS / 3_600_000} h`);
  });

  it('explica el criterio pesimista y la zona de duda', () => {
    const { container } = render(<MetodologiaInfo />);
    const t = container.textContent ?? '';
    expect(t).toMatch(/borde pesimista/);
    expect(t).toMatch(/21 % y el 34 %/);
  });
});
