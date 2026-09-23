import { SURGE } from '@/lib/config/boat';
import { compass } from '@/lib/format';
import { UNCERTAINTY_NOW_M, UNCERTAINTY_12H_M, SLACK_CM_H } from '@/lib/domain/tideWindow';
import { OBSERVED_STALE_MS, OBSERVED_SEVERE_MS } from '@/lib/hooks/useFreshness';

const hs = (ms: number) => ms / 3_600_000;

function sectorLabel([from, to]: [number, number]): string {
  return `${compass(from)}–${compass(to)} (${from}°–${to}°)`;
}

/**
 * Bloque desplegable que explica de dónde salen los datos, cómo se estima el
 * nivel de agua y cómo la app calcula la predicción de sudestada/bajante.
 *
 * Los números salen de las constantes reales (`SURGE`, la banda de
 * incertidumbre, los umbrales de antigüedad) para que el texto no se
 * desactualice respecto del código cuando alguno cambie.
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
              <em>medido</em>, no un pronóstico. El mareógrafo mide a los :45 de cada hora y el
              INA lo publica en la hora siguiente, así que lo más nuevo que se puede ver tiene
              normalmente <strong>entre 1 y 2 h</strong>.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-1 font-semibold text-slate-700">
            Nivel de agua: lo medido y lo estimado
          </h3>
          <p className="mb-2">
            En el gráfico, la <strong>línea llena</strong> es lo que midió el mareógrafo y la{' '}
            <strong>punteada con banda</strong> es estimación. El corte entre las dos está
            donde termina lo que se sabe y empieza lo que se calcula.
          </p>
          <ul className="space-y-1">
            <li>
              <span className="text-slate-300">•</span> <strong>Cómo se estima:</strong> se toma
              el nivel del mar pronosticado por Open-Meteo Marine y se lo <em>reancla</em> al
              cero del mareógrafo con las últimas mediciones reales. Hace falta reanclarlo
              porque la diferencia entre las dos referencias ronda los 0,90 m y se corre con la
              bajante del río: una constante no alcanzaría.
            </li>
            <li>
              <span className="text-slate-300">•</span> <strong>Margen de error:</strong> ±
              {UNCERTAINTY_NOW_M.toFixed(2)} m para el ahora, creciendo hasta ±
              {UNCERTAINTY_12H_M.toFixed(2)} m a las 12 h. Salen de comparar el método contra el
              nivel realmente observado durante 14 días en 4 estaciones del Río de la Plata.
            </li>
            <li>
              <span className="text-slate-300">•</span> <strong>Por qué no se afina más:</strong>{' '}
              también se probó arrastrar el último dato y proyectar la pendiente de las últimas
              2 h. Dan el mismo error o peor: proyectar la pendiente se pasa de largo cerca de
              las paradas de marea. Hay un piso de ~15 cm que ningún método baja, así que se
              muestra en vez de esconderlo.
            </li>
            <li>
              <span className="text-slate-300">•</span> <strong>Marea entrando o saliendo:</strong>{' '}
              es la velocidad a la que cambia el nivel medido (cm/h) en las últimas 2 h, no una
              corriente medida —y por eso no se expresa en nudos—. En el estuario la corriente
              de marea va aproximadamente en fase con esa variación, así que el sentido sirve
              para saber de qué lado vas a tenerla al cruzar. Por debajo de {SLACK_CM_H} cm/h se
              considera parada, porque ahí el signo no significa nada. No hay ninguna fuente
              pública de corriente para el Río de la Plata.
            </li>
            <li>
              <span className="text-slate-300">•</span> <strong>Si la estación deja de
              reportar:</strong> a partir de {hs(OBSERVED_STALE_MS)} h el dato se marca en
              ámbar, y a partir de {hs(OBSERVED_SEVERE_MS)} h se avisa que probablemente esté
              caída.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-1 font-semibold text-slate-700">
            Tu amarra: cuándo la app admite que no sabe
          </h3>
          <p className="mb-2">
            Si cargaste los niveles seguros de tu amarra en Perfil, el nivel estimado se compara
            contra ellos usando el <strong>borde pesimista</strong> de la banda: un tramo se
            marca como poca agua o agua alta apenas el margen toca el umbral, no cuando lo cruza
            el valor central. Para «¿voy a varar?» conviene errar hacia salir antes.
          </p>
          <p>
            Y cuando la banda queda a caballo del umbral, la app lo dice en vez de dar un
            veredicto. No es prudencia de más: sobre los mismos 14 días, con el nivel a menos de
            30 cm del umbral la respuesta binaria se equivoca <strong>entre el 21 % y el 34 %</strong>{' '}
            de las veces.
          </p>
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
