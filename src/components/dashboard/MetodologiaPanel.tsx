import { scoringFor, DAYLIGHT } from '@/lib/config/boat';
import type { Caution } from '@/lib/profile/types';

/**
 * Bloque desplegable del panel que explica de dónde salen los datos y cómo se
 * calcula el semáforo de navegabilidad. Lee los umbrales reales de `scoringFor`
 * (que dependen del nivel de tolerancia elegido) para no quedar desactualizado
 * respecto del código.
 */
/** Visibilidad legible: metros por debajo de 1 km, km por encima. */
function vis(m: number): string {
  return m < 1000 ? `${m} m` : `${m / 1000} km`;
}

export function MetodologiaPanel({ caution = 'normal' }: { caution?: Caution }) {
  const t = scoringFor(caution);
  return (
    <details className="group rounded-xl border border-slate-100 bg-white shadow-sm">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-mar-700 marker:content-none">
        <span>Cómo se calcula esto · de dónde salen los datos</span>
        <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
      </summary>

      <div className="space-y-4 border-t border-slate-100 px-4 py-4 text-sm text-slate-600">
        <div>
          <h3 className="mb-1 font-semibold text-slate-700">Fuentes de datos</h3>
          <ul className="space-y-1">
            <li>
              <span className="text-slate-300">•</span> <strong>Viento, ráfagas, lluvia,
              temperatura y visibilidad:</strong>{' '}
              <a className="underline" href="https://open-meteo.com" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>{' '}
              (pronóstico horario de los próximos 7 días en las coordenadas de tu lugar; gratis,
              sin registro).
            </li>
            <li>
              <span className="text-slate-300">•</span> Los datos se actualizan cuando abrís la
              app; si estás sin conexión se muestra el último pronóstico guardado.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-1 font-semibold text-slate-700">Cómo se arma el semáforo del día</h3>
          <p className="mb-2">
            Para cada día se miran solo las <strong>horas de luz</strong> (de{' '}
            {DAYLIGHT.sunriseHour}:00 a {DAYLIGHT.sunsetHour}:00). Se toma el{' '}
            <strong>viento mediano</strong>, la <strong>ráfaga máxima</strong> y la{' '}
            <strong>lluvia total</strong> de esas horas, y se asigna el peor color que
            corresponda según tus umbrales (tolerancia: <strong>{caution}</strong>):
          </p>
          <ul className="space-y-1">
            <li>
              <span className="text-slate-300">•</span> 🟢 <strong>Verde:</strong> viento entre{' '}
              {t.idealWindMin} y {t.idealWindMax} kt, sin ráfagas ni lluvia que molesten.
            </li>
            <li>
              <span className="text-slate-300">•</span> 🟡 <strong>Amarillo</strong> (precaución):
              viento ≥ {t.strongWind} kt, ráfagas ≥ {t.gustYellow} kt, lluvia ≥ {t.rainYellow} mm
              o visibilidad ≤ {vis(t.fogYellowM)} (posible neblina).
            </li>
            <li>
              <span className="text-slate-300">•</span> 🔴 <strong>Rojo</strong> (mejor no salir):
              viento ≥ {t.dangerWind} kt, ráfagas ≥ {t.gustRed} kt, lluvia ≥ {t.rainRed} mm
              o visibilidad ≤ {vis(t.fogRedM)} (posible niebla).
            </li>
            <li>
              <span className="text-slate-300">•</span> 💤 <strong>Poco viento:</strong> menos de{' '}
              {t.idealWindMin} kt — no es peligro, pero probablemente no se pueda navegar a vela.
            </li>
          </ul>
          <p className="mt-2">
            Una <strong>alerta de marea meteorológica</strong> (sudestada / bajante) activa ese día
            también baja el color. El detalle de cómo se calcula esa alerta está en la pestaña{' '}
            <strong>Mareas</strong>.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            El pronóstico de <strong>niebla</strong> es poco confiable (sobre todo la niebla
            matinal y la que se forma sobre el agua): tomá el aviso como “posible” y confirmá la
            visibilidad real antes de salir.
          </p>
        </div>

        <p className="text-xs text-slate-400">
          Es un modelo propio y <strong>orientativo</strong>, no un pronóstico oficial. Cambiá tu
          nivel de tolerancia (prudente / normal / audaz) para mover los umbrales. Verificá siempre
          antes de navegar.
        </p>
      </div>
    </details>
  );
}
