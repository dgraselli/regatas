import Script from 'next/script';

const SRC = process.env.NEXT_PUBLIC_UMAMI_SRC;
const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const OPENPANEL_CLIENT_ID = process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID;

/**
 * Carga el script de Umami (analítica anónima, sin cookies) solo si está
 * configurado por variables de entorno. Si no, no renderiza nada.
 */
export function Analytics() {
  if (!SRC || !WEBSITE_ID) return null;
  return <Script src={SRC} data-website-id={WEBSITE_ID} strategy="afterInteractive" />;
}

/**
 * Carga OpenPanel (contador de visitas/eventos) solo si está configurado.
 * El shim de `window.op` va primero: next/script respeta el orden entre
 * scripts de la misma estrategia, así que encola las llamadas antes de que
 * op1.js termine de cargar.
 */
export function OpenPanelAnalytics() {
  if (!OPENPANEL_CLIENT_ID) return null;
  return (
    <>
      <Script id="openpanel-init" strategy="afterInteractive">
        {`window.op=window.op||function(){var n=[];return new Proxy(function(){arguments.length&&n.push([].slice.call(arguments))},{get:function(t,r){return"q"===r?n:function(){n.push([r].concat([].slice.call(arguments)))}} ,has:function(t,r){return"q"===r}}) }();
window.op('init', {
  clientId: '${OPENPANEL_CLIENT_ID}',
  trackScreenViews: true,
  trackOutgoingLinks: true,
  trackAttributes: true,
});`}
      </Script>
      <Script src="https://openpanel.dev/op1.js" strategy="afterInteractive" />
    </>
  );
}
