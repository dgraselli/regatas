import { Card } from '@/components/ui/Card';

export const metadata = {
  title: 'Ayuda — Regatas',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-slate-800">{title}</h2>
      <div className="text-sm text-slate-600 space-y-2">{children}</div>
    </section>
  );
}

export default function AyudaPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ayuda</h1>
        <p className="text-slate-500 text-sm">
          Qué es Regatas, para qué sirve y cómo usarla.
        </p>
      </div>

      <Card className="p-4">
        <Section title="¿Qué es?">
          <p>
            <strong>Regatas</strong> es un asistente para decidir si conviene salir a navegar en el{' '}
            <strong>Río de la Plata</strong>, tanto a <strong>vela</strong> como a{' '}
            <strong>motor</strong>. Combina el pronóstico de viento con las características de tu
            barco y te da, de un vistazo, un <strong>semáforo de navegabilidad</strong>, alertas de{' '}
            <strong>marea meteorológica</strong> (sudestada / bajante) y de <strong>niebla</strong>,
            y un <strong>planificador de cruce</strong> entre dos puntos.
          </p>
          <p className="text-xs text-slate-400">
            Elegís el tipo de propulsión al cargar el barco: a <strong>vela</strong> el poco viento
            penaliza (no se puede navegar); a <strong>motor</strong> no, y el cruce se calcula a
            velocidad de crucero constante en vez de con la polar.
          </p>
          <p className="text-xs text-slate-400">
            Tus datos (barcos, lugares, preferencias) se guardan solo en este navegador, sin
            registro ni cuenta.
          </p>
        </Section>
      </Card>

      <Card className="p-4">
        <Section title="Primer paso: tu perfil">
          <p>
            Entrá a <strong>Mi perfil</strong> y cargá:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Tu barco</strong> (nombre, propulsión y eslora en pies). A{' '}
              <strong>vela</strong>, de la eslora se estima la polar (velocidad y rumbos). A{' '}
              <strong>motor</strong>, cargás la <strong>velocidad de crucero</strong> y el cruce se
              calcula con esa velocidad constante.
            </li>
            <li>
              <strong>Tus lugares</strong>: tu amarra y los destinos. Podés elegir un club conocido
              o pegar coordenadas (en Google Maps, clic derecho sobre un punto las copia). Marcá tu
              amarra como <strong>lugar activo</strong> del panel.
            </li>
            <li>
              <strong>Tolerancia</strong> (prudente / normal / audaz) y el{' '}
              <strong>umbral de poco viento</strong>.
            </li>
          </ul>
        </Section>
      </Card>

      <Card className="p-4">
        <Section title="Panel — ¿salimos a navegar?">
          <p>Para cada día, un color resume las condiciones de las horas de luz:</p>
          <ul className="space-y-1">
            <li>🟢 <strong>Navegable</strong> · 🟡 <strong>Precaución</strong> · 🔴 <strong>No recomendable</strong> · 💤 <strong>Poco viento</strong> (probablemente no se pueda navegar a vela; <strong>a motor no aplica</strong>, el agua tranquila es ideal).</li>
          </ul>
          <p>
            Abajo de cada tarjeta ves la condición del cielo (☀️ ⛅ ☁️ 🌧️), temperatura y lluvia.
            Si la tarjeta dice <strong>«Niebla temporal a primera hora»</strong> o <strong>«Neblina
            temporal por la tarde»</strong>, hubo niebla solo en parte del día (queda una ventana
            navegable): dice «niebla» si es cerrada y «neblina» si es liviana, y el momento en que
            aparece. En cambio, la <strong>niebla cerrada que dura más de 2 horas baja el día a
            precaución</strong> aunque después despeje, y si cubre toda la jornada lo marca como no
            recomendable.
            Al elegir un día se despliegan los <strong>motivos</strong> (con íconos: 🌬️ viento, 💨
            ráfagas, 🌧️ lluvia, 🌫️ niebla, 🌊 sudestada…) y el <strong>gráfico por hora</strong>:
            barras de viento y ráfagas, <strong>flechas</strong> que muestran hacia dónde sopla,
            líneas de umbral (precaución / peligro / poco viento) y bandas cuando baja la
            visibilidad. Arriba aparece un <strong>resumen de marea</strong> (nivel observado y si se
            prevé agua muy alta o muy baja para entrar/salir de la amarra).
          </p>
        </Section>
      </Card>

      <Card className="p-4">
        <Section title="Criterios del semáforo">
          <p>
            El color del día es el del <strong>factor más exigente</strong>, mirando solo las{' '}
            <strong>horas de luz</strong> (7–19 h). El viento se evalúa por la <strong>mediana</strong>{' '}
            del día y las ráfagas por el <strong>pico</strong>. Valores para tolerancia{' '}
            <em>normal</em>:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 pr-3 font-medium">Factor</th>
                  <th className="py-1 pr-3 font-medium">🟡 Precaución</th>
                  <th className="py-1 font-medium">🔴 No recomendable</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-b border-slate-100">
                  <td className="py-1 pr-3">Viento sostenido (mediana)</td>
                  <td className="py-1 pr-3">≥ 22 kt</td>
                  <td className="py-1">≥ 28 kt</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 pr-3">Ráfagas (pico)</td>
                  <td className="py-1 pr-3">≥ 25 kt</td>
                  <td className="py-1">≥ 33 kt</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 pr-3">Lluvia (total del día)</td>
                  <td className="py-1 pr-3">≥ 2 mm</td>
                  <td className="py-1">≥ 12 mm</td>
                </tr>
                <tr>
                  <td className="py-1 pr-3">Marea (sudestada / bajante)</td>
                  <td className="py-1 pr-3">evento moderado</td>
                  <td className="py-1">evento fuerte</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="font-medium text-slate-700">Niebla / visibilidad</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Niebla cerrada</strong> = visibilidad ≤ 1 km; <strong>neblina</strong>{' '}
              (visibilidad reducida) = ≤ 4 km.
            </li>
            <li>
              🟢 <strong>No degrada</strong> (se marca «temporal»): niebla cerrada <strong>≤ 2 h</strong>{' '}
              o neblina liviana, siempre que despeje y quede una <strong>ventana navegable</strong>{' '}
              (≥ 4 h de luz despejadas antes o después).
            </li>
            <li>
              🟡 <strong>Precaución</strong>: niebla cerrada de <strong>más de 2 h</strong> aunque
              después despeje; o neblina que cubre toda la jornada.
            </li>
            <li>
              🔴 <strong>No recomendable</strong>: niebla cerrada que cubre toda la jornada (sin
              ventana navegable).
            </li>
          </ul>
          <p>
            💤 <strong>Poco viento</strong>: si el día sería verde pero la mediana de viento queda por
            debajo de tu <strong>umbral de poco viento</strong> (default 6 kt), se marca aparte —
            probablemente no se pueda navegar a vela. Si tu barco es <strong>a motor</strong> esto no
            aplica: el poco viento (agua tranquila) queda verde.
          </p>
          <p className="text-xs text-slate-400">
            La <strong>tolerancia</strong> (prudente / normal / audaz) corre estos umbrales: el
            prudente es más estricto (p. ej. viento fuerte desde 18 kt, niebla desde 6 km) y el audaz
            más permisivo (viento fuerte desde 26 kt, niebla desde 2 km). El umbral de «poco viento»
            no cambia con la tolerancia: ser audaz no crea viento donde no lo hay.
          </p>
        </Section>
      </Card>

      <Card className="p-4">
        <Section title="Mareas">
          <p>
            La pestaña <strong>Mareas</strong> reúne lo relativo al nivel del agua en tu zona:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Nivel de agua observado</strong> del INA (estación más cercana): un dato{' '}
              <em>medido</em>, no un pronóstico.
            </li>
            <li>
              <strong>Marea meteorológica</strong>: <em>sudestada</em> (sube el agua, riesgo de
              inundar el club) y <em>bajante</em> (baja el agua, riesgo de varadura), con su ventana
              horaria.
            </li>
          </ul>
          <p className="text-xs text-slate-400">
            Las alertas de <strong>niebla / visibilidad reducida</strong> aparecen en el{' '}
            <strong>panel</strong>, junto al pronóstico del día.
          </p>
        </Section>
      </Card>

      <Card className="p-4">
        <Section title="Cruce">
          <p>
            Elegí <strong>salida</strong>, <strong>destino</strong> y <strong>barco</strong>, y la
            app evalúa la travesía a distintas horas de los próximos 7 días. Te muestra las{' '}
            <strong>salidas en orden cronológico</strong>, cada una con su semáforo, hora de llegada
            estimada y advertencias (niebla, marea, llegada de noche, y —según el barco— rizos por
            ráfagas a vela o mar formado a motor). A <strong>vela</strong> los tiempos salen de la
            polar (con bordejeo si el rumbo cae de proa); a <strong>motor</strong>, de la velocidad
            de crucero. La marcada como <strong>“mejor”</strong> es la recomendada. La tolerancia es
            la misma del panel.
          </p>
          <p className="text-xs text-slate-400">
            Tus elecciones de salida/destino/barco quedan guardadas para la próxima vez.
          </p>
        </Section>
      </Card>

      <Card className="p-4">
        <Section title="Importante">
          <p>
            Es un modelo propio y <strong>orientativo</strong>, no un pronóstico oficial. El de
            niebla, en particular, es poco confiable. <strong>Verificá siempre el pronóstico oficial
            (SMN / SHN) antes de salir</strong> y confirmá las condiciones en el lugar.
          </p>
        </Section>
      </Card>
    </div>
  );
}
