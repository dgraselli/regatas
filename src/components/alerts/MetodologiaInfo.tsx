import { SURGE } from '@/lib/config/boat';
import { compass } from '@/lib/format';

function sectorLabel([from, to]: [number, number]): string {
  return `${compass(from)}–${compass(to)} (${from}°–${to}°)`;
}

/**
 * Bloque desplegable que explica de dónde salen los datos y cómo la app
 * calcula la predicción de sudestada/bajante. Lee los umbrales reales de
 * `SURGE` para no quedar desactualizado respecto del código.
 */
export function MetodologiaInfo({ stationName }: { stationName?: string }) {
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
              <span className="text-slate-300">•</span> <strong>Viento y clima:</strong>{' '}
              <a className="underline" href="https://open-meteo.com" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>{' '}
              (pronóstico de los próximos 7 días en las coordenadas de tu lugar; gratis, sin
              registro).
            </li>
            <li>
              <span className="text-slate-300">•</span> <strong>Nivel de agua observado:</strong>{' '}
              INA — Sistema de Alerta Hidrológico (API pública), altura hidrométrica de la
              estación más cercana
              {stationName ? <> (hoy: <strong>{stationName}</strong>)</> : null}. Es un dato{' '}
              <em>medido</em>, no un pronóstico.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-1 font-semibold text-slate-700">Cómo se predice la marea meteorológica</h3>
          <p className="mb-2">
            En el Río de la Plata la marea astronómica es chica: lo que mueve el agua es el{' '}
            <strong>viento sostenido</strong>. La app analiza hora por hora el pronóstico y
            marca un evento cuando el viento viene de un sector de riesgo con fuerza y
            persistencia suficientes:
          </p>
          <ul className="space-y-1">
            <li>
              <span className="text-slate-300">•</span> <strong>Sudestada</strong> (sube el agua,
              riesgo de inundar el club): viento del {sectorLabel(SURGE.sudestadaSector)}.
            </li>
            <li>
              <span className="text-slate-300">•</span> <strong>Bajante</strong> (baja el agua,
              riesgo de varadura): viento del {sectorLabel(SURGE.bajanteSector)}.
            </li>
            <li>
              <span className="text-slate-300">•</span> En ambos casos hace falta viento de{' '}
              <strong>≥ {SURGE.minWindKt} kt</strong> sostenido durante{' '}
              <strong>≥ {SURGE.minHours} horas</strong> seguidas.
            </li>
          </ul>
          <p className="mt-2">
            La <strong>severidad</strong> (leve / marcada / severa) crece con la duración y la
            intensidad del viento. Además, si el nivel del mar pronosticado (Open-Meteo Marine)
            acompaña la tendencia esperada, sube la <strong>confianza</strong> de la alerta; si la
            contradice, baja.
          </p>
        </div>

        <p className="text-xs text-slate-400">
          Es un modelo propio y <strong>orientativo</strong>, no un pronóstico oficial. El
          pronóstico oficial de altura de agua y sudestadas lo emite el{' '}
          <a className="underline" href="https://www.hidro.gob.ar" target="_blank" rel="noreferrer">
            Servicio de Hidrografía Naval (SHN)
          </a>
          . Verificá siempre antes de navegar.
        </p>
      </div>
    </details>
  );
}
