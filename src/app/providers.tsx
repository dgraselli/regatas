'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ProfileProvider } from '@/lib/profile/ProfileContext';

/**
 * Provee React Query con persistencia en localStorage para que el último
 * pronóstico esté disponible offline (PWA).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 30, // 30 min
            gcTime: 1000 * 60 * 60 * 24, // 24 h
            retry: 1,
            // Refrescar al volver a la pestaña: si no, una pestaña abierta se
            // queda con datos viejos para siempre (no hay otro disparador).
            refetchOnWindowFocus: true,
            // Con el networkMode default, un navigator.onLine mentiroso (VPN,
            // adaptador virtual) PAUSA todos los refetch y la app queda
            // congelada sirviendo el caché persistido. 'always' intenta igual;
            // si de verdad no hay red, queda el dato viejo + StaleForecastNotice.
            networkMode: 'always',
          },
        },
      }),
  );

  const [persister] = useState(() =>
    typeof window === 'undefined'
      ? null
      : createSyncStoragePersister({ storage: window.localStorage, key: 'regatas-cache' }),
  );

  // Registrar el service worker para PWA.
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {
        /* sin SW no pasa nada grave */
      });
    }
  }, []);

  if (!persister) {
    // SSR / prerender: cliente sin persistencia (se hidrata en el navegador).
    return (
      <QueryClientProvider client={client}>
        <ProfileProvider>{children}</ProfileProvider>
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={client}
      // `buster` invalida el caché persistido. Se sube al cambiar la FORMA de los
      // datos (ver tipos de forecast/crossing/water), y también cuando un bug
      // corregido dejó CONTENIDO malo guardado: el caché sobrevive al deploy, así
      // que si no se lo desaloja el usuario sigue viendo el dato viejo hasta que
      // venza el staleTime. Pasó con `dayWindow`, que guardaba el nivel de anoche
      // y disparaba un falso "la estación puede estar caída".
      persistOptions={{ persister, buster: 'schema-14' }}
    >
      <ProfileProvider>{children}</ProfileProvider>
    </PersistQueryClientProvider>
  );
}
