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
            refetchOnWindowFocus: false,
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
      navigator.serviceWorker.register('/sw.js').catch(() => {
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
    <PersistQueryClientProvider client={client} persistOptions={{ persister }}>
      <ProfileProvider>{children}</ProfileProvider>
    </PersistQueryClientProvider>
  );
}
