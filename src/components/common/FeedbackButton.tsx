'use client';

import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';
import { APP_VERSION } from '@/lib/version';

const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL;

/**
 * Enlace a un formulario externo de feedback (ej. Tally). Adjunta la página
 * actual (`page`) y la versión de la app (`version`) como parámetros — el form
 * los captura en campos ocultos. No renderiza nada si no está configurado.
 */
export function FeedbackButton({ className = '' }: { className?: string }) {
  const pathname = usePathname();
  if (!FEEDBACK_URL) return null;

  const params = new URLSearchParams({ page: pathname, version: APP_VERSION });
  const sep = FEEDBACK_URL.includes('?') ? '&' : '?';
  const href = `${FEEDBACK_URL}${sep}${params.toString()}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => track('feedback_open', { page: pathname, version: APP_VERSION })}
      className={`underline hover:text-mar-600 ${className}`}
    >
      💬 Enviar feedback
    </a>
  );
}
