import { describe, it, expect } from 'vitest';
import { dayWindow } from '@/lib/services/inaHidrologico';

describe('dayWindow — ventana de consulta al INA', () => {
  // El a5 lee una fecha sin hora como medianoche argentina. Si el fin fuera
  // "hoy", la respuesta cortaría en la medianoche pasada y la app nunca vería
  // una sola observación del día en curso.
  it('pide hasta mañana para no perder el día en curso', () => {
    const now = Date.parse('2026-09-06T13:12:00Z'); // 10:12 en Buenos Aires
    expect(dayWindow(3, now)).toEqual({ start: '2026-09-03', end: '2026-09-07' });
  });

  it('el fin nunca es anterior al día de hoy', () => {
    // Última hora del día en Argentina: en UTC ya es el día siguiente.
    const now = Date.parse('2026-09-07T02:30:00Z'); // 23:30 del 06 en Buenos Aires
    const { end } = dayWindow(3, now);
    expect(end > '2026-09-06').toBe(true);
  });

  it('el inicio retrocede los días pedidos', () => {
    const now = Date.parse('2026-09-06T13:12:00Z');
    expect(dayWindow(7, now).start).toBe('2026-08-30');
  });
});
