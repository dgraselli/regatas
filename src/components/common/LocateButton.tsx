'use client';

import { useState } from 'react';
import { useProfile } from '@/lib/profile/ProfileContext';
import { nearestLocationId } from '@/lib/profile/defaults';

type Status = 'idle' | 'loading' | 'error' | 'unsupported';

/**
 * Botón que, a pedido del usuario, pide la geolocalización del navegador y
 * activa el lugar guardado más cercano. La geolocalización solo se solicita
 * con este gesto (nunca automáticamente al cargar).
 */
export function LocateButton() {
  const { profile, setActiveLocation } = useProfile();
  const [status, setStatus] = useState<Status>('idle');

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const id = nearestLocationId(profile.locations, pos.coords.latitude, pos.coords.longitude);
        if (id) setActiveLocation(id);
        setStatus('idle');
      },
      () => setStatus('error'),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  };

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <button
        type="button"
        onClick={locate}
        disabled={status === 'loading' || profile.locations.length === 0}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-mar-500 disabled:opacity-50"
      >
        📍 {status === 'loading' ? 'Ubicando…' : 'Usar mi ubicación'}
      </button>
      {status === 'error' && (
        <span className="text-amber-600">No se pudo obtener tu ubicación.</span>
      )}
      {status === 'unsupported' && (
        <span className="text-amber-600">Tu navegador no permite geolocalización.</span>
      )}
    </span>
  );
}
