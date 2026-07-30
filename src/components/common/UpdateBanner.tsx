'use client';

import { useServiceWorkerUpdate } from '@/lib/hooks/useServiceWorkerUpdate';

/**
 * Aviso de que hay una versión nueva publicada (el service worker ya la tomó
 * en segundo plano). El usuario decide cuándo recargar, no se fuerza sola.
 */
export function UpdateBanner() {
  const { updateAvailable, reload } = useServiceWorkerUpdate();
  if (!updateAvailable) return null;

  return (
    <div role="status" className="bg-mar-800 border-b border-mar-700 text-white text-sm">
      <div className="mx-auto max-w-4xl px-4 py-2 flex items-center justify-center gap-3 text-center">
        <span aria-hidden>🔄</span>
        <p>Hay una versión nueva de la app.</p>
        <button
          type="button"
          onClick={reload}
          className="underline font-medium hover:text-mar-200"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
