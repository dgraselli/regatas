// TEMPORAL — quitar cuando la app salga de etapa de pruebas.
// Aviso global de que la aplicación todavía no es apta para planificar
// navegaciones reales. Se renderiza en el layout, en todas las páginas.
export function BetaBanner() {
  return (
    <div
      role="alert"
      className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs"
    >
      <div className="mx-auto max-w-4xl px-4 py-1 flex items-center justify-center gap-1.5 text-center">
        <span aria-hidden>⚠️</span>
        <p>
          Esta app está en etapa de desarrollo. Verificá siempre el pronóstico
          oficial antes de salir.
        </p>
      </div>
    </div>
  );
}
