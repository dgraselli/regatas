'use client';

import { useEffect, useState } from 'react';

/**
 * Detecta cuando el service worker activo cambió mientras la app ya estaba
 * abierta (se publicó una versión nueva). No recarga sola —podría cortar al
 * usuario a mitad de una acción (p.ej. llenando el planificador de cruce)—,
 * solo avisa; `reload()` la aplica cuando el usuario lo pide.
 */
export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // El primer 'controllerchange' (sin controller previo) es la activación
    // inicial del SW, no una actualización: no hay que avisar de eso.
    let hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (hadController) setUpdateAvailable(true);
      hadController = true;
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Si la PWA quedó abierta en segundo plano, forzar el chequeo de versión
    // nueva al volver a primer plano (mismo criterio que el refetch de datos
    // en providers.tsx: 'volver a la pestaña' es el disparador natural).
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { updateAvailable, reload: () => window.location.reload() };
}
