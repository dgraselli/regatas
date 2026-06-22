import Script from 'next/script';

const SRC = process.env.NEXT_PUBLIC_UMAMI_SRC;
const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

/**
 * Carga el script de Umami (analítica anónima, sin cookies) solo si está
 * configurado por variables de entorno. Si no, no renderiza nada.
 */
export function Analytics() {
  if (!SRC || !WEBSITE_ID) return null;
  return <Script src={SRC} data-website-id={WEBSITE_ID} strategy="afterInteractive" />;
}
