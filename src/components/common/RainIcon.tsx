/**
 * Ícono de lluvia: rayas diagonales, en celeste para lluvia ligera y azul más
 * oscuro y grueso para lluvia fuerte. Deliberadamente distinto del lenguaje de
 * la niebla (líneas onduladas horizontales, gris) para que se distinga a
 * simple vista: la lluvia son trazos diagonales, como gotas cayendo.
 */
export function RainIcon({
  heavy,
  label,
  className = 'h-2.5 w-4',
}: {
  heavy: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 10"
      className={`${className} ${heavy ? 'text-blue-600' : 'text-sky-400'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={heavy ? 1.6 : 1.1}
      strokeLinecap="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}
      <path d="M3 0.5 L1 5" />
      <path d="M7.5 0.5 L5.5 5" />
      <path d="M12 0.5 L10 5" />
      <path d="M15.5 0.5 L13.5 5" />
      <path d="M5 5.5 L3 10" opacity={0.7} />
      <path d="M9.5 5.5 L7.5 10" opacity={0.7} />
      <path d="M14 5.5 L12 10" opacity={0.7} />
    </svg>
  );
}
