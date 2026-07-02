import { USE_MOCKS } from '@/lib/services/http';

// Aviso global cuando la app corre con DATOS DE EJEMPLO (mocks) en vez de
// datos reales de Open-Meteo / INA. Se activa con NEXT_PUBLIC_USE_MOCKS=true
// (default true; en este repo el .env.local lo pone en false → datos reales).
// Sirve para no confundir un escenario de prueba con el pronóstico real.
export function MockBanner() {
  if (!USE_MOCKS) return null;
  return (
    <div
      role="status"
      className="bg-fuchsia-100 border-b border-fuchsia-300 text-fuchsia-900 text-sm"
    >
      <div className="mx-auto max-w-4xl px-4 py-2 flex items-start gap-2">
        <span aria-hidden className="leading-5">
          🧪
        </span>
        <p className="leading-5">
          <strong>Datos de ejemplo (mocks)</strong> — no es el pronóstico real. Escenario
          determinístico para pruebas locales.
        </p>
      </div>
    </div>
  );
}
