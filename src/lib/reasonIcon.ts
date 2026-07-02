/**
 * Ícono representativo para un motivo del semáforo (a la izquierda del texto).
 * Se elige por palabra clave del motivo. El orden importa: las más específicas
 * van primero (p. ej. "poco viento" antes que "viento", y "buenas condiciones"
 * antes que "lluvia", porque el texto dice "sin lluvia").
 */
export function reasonIcon(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('buenas condiciones')) return '✅';
  if (r.includes('niebla') || r.includes('visibilidad')) return '🌫️';
  if (r.includes('ráfaga') || r.includes('rafaga')) return '💨';
  if (r.includes('sudestada')) return '🌊';
  if (r.includes('ola')) return '🌊';
  if (r.includes('bajante')) return '🏜️';
  if (r.includes('lluvia')) return '🌧️';
  if (r.includes('poco viento')) return '🍃';
  if (r.includes('viento')) return '🌬️';
  return '•';
}
