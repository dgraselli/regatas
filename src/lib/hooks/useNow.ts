'use client';

import { useEffect, useState } from 'react';
import { nowInTz } from '@/lib/format';

/**
 * Fecha y hora actuales ('YYYY-MM-DDTHH:mm') en la zona horaria dada, con
 * actualización automática. Al ser un string al minuto, los re-renders solo
 * ocurren cuando cambia el minuto (setState con el mismo string no re-renderiza).
 */
export function useNowInTz(timezone: string): string {
  const [now, setNow] = useState(() => nowInTz(timezone));
  useEffect(() => {
    setNow(nowInTz(timezone));
    const id = setInterval(() => setNow(nowInTz(timezone)), 30_000);
    return () => clearInterval(id);
  }, [timezone]);
  return now;
}
