/**
 * Ícono de niebla/neblina: líneas onduladas, en gris claro para neblina y más
 * oscuro para niebla. Mismo lenguaje visual que las ondas del gráfico horario.
 * Compacto para no empujar el layout de las tarjetas.
 */
export function FogIcon({
  dense,
  label,
  className = 'h-2.5 w-4',
}: {
  dense: boolean;
  label?: string;
  className?: string;
}) {
  const wave = 'q1.75 -1.4 3.5 0 t3.5 0 t3.5 0';
  return (
    <svg
      viewBox="0 0 16 10"
      className={`${className} ${dense ? 'text-slate-600' : 'text-slate-400'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}
      <path d={`M1 2 ${wave}`} />
      <path d={`M1 5 ${wave}`} />
      <path d={`M1 8 ${wave}`} />
    </svg>
  );
}
