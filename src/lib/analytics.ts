/**
 * Analítica anónima y sin cookies (Umami). Todas las llamadas son no-op si Umami
 * no está cargado/configurado, así la app funciona igual sin analítica y nunca
 * se rompe por su culpa.
 */
declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
  }
}

/** Registra un evento personalizado (ej. 'add_known_club'). Seguro de llamar siempre. */
export function track(event: string, data?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.umami) return;
  try {
    window.umami.track(event, data);
  } catch {
    /* nunca romper la app por analítica */
  }
}
