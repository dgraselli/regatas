'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics';

const SEEN_KEY = 'regatas-welcome-v1';

/**
 * Modal de bienvenida que se muestra una sola vez (primer uso). La marca de
 * "ya visto" vive en localStorage con clave propia, separada del perfil, para
 * no tocar la forma de los datos cacheados.
 */
export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return; // almacenamiento bloqueado: no molestar en cada visita
    }
    setOpen(true);
    track('welcome_shown');
  }, []);

  if (!open) return null;

  const dismiss = (action: 'empezar' | 'agregar-barco') => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* se ignora */
    }
    track('welcome_dismiss', { action });
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      onClick={() => dismiss('empezar')}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl mb-3">⛵</div>
        <h2 id="welcome-title" className="text-lg font-semibold text-slate-800">
          ¡Bienvenido a Regatas!
        </h2>
        <div className="mt-2 space-y-2 text-sm text-slate-600">
          <p>
            Te ayuda a decidir <strong>qué día conviene salir a navegar</strong> por el
            Río de la Plata: un semáforo por día según viento, olas, lluvia, niebla y
            marea, con alertas de sudestada y bajante y un planificador de cruce.
          </p>
          <p>
            Si agregás tu barco —velero, lancha o crucero— le sacás más provecho: el
            pronóstico se ajusta a cómo navegás. Igual podés usarla sin definirlo.
          </p>
          <p className="text-slate-500">
            Toda sugerencia de mejora es bienvenida a través del formulario de feedback
            (💬 al pie de la página).
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/perfil"
            onClick={() => dismiss('agregar-barco')}
            className="rounded-lg bg-mar-600 px-4 py-2 text-sm font-medium text-white hover:bg-mar-700"
          >
            Agregar mi barco
          </Link>
          <button
            type="button"
            onClick={() => dismiss('empezar')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Empezar sin barco
          </button>
        </div>
      </div>
    </div>
  );
}
