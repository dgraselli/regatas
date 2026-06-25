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
            <strong>Regatas</strong> es un asistente para decidir si conviene salir a navegar a
            vela en el <strong>Río de la Plata</strong>. Combina el pronóstico de viento con la
            polar de tu velero y te da, de un vistazo, un <strong>semáforo de navegabilidad</strong>,
            alertas de <strong>marea meteorológica</strong> (sudestada / bajante) y de{' '}
            <strong>niebla</strong>, y un <strong>planificador de cruce</strong> entre dos puntos.
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
              <strong>Tu barco</strong> (nombre y eslora en pies): de la eslora se estima la polar,
              que define velocidad y rumbos.
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
            <li>🟢 <strong>Navegable</strong> · 🟡 <strong>Precaución</strong> · 🔴 <strong>No recomendable</strong> · 💤 <strong>Poco viento</strong> (probablemente no se pueda navegar a vela).</li>
          </ul>
          <p>
            Abajo de cada tarjeta ves la condición del cielo (☀️ ⛅ ☁️ 🌧️), temperatura y lluvia.
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
        <Section title="Alertas">
          <p>
            Dos tipos de eventos a partir del pronóstico de tu zona:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Marea meteorológica</strong>: <em>sudestada</em> (sube el agua, riesgo de
              inundar el club) y <em>bajante</em> (baja el agua, riesgo de varadura), con su ventana
              horaria. Además se muestra el <strong>nivel de agua observado</strong> del INA.
            </li>
            <li>
              <strong>Visibilidad / niebla</strong>: ventanas de visibilidad reducida, con el
              horario en que conviene esperar a que levante.
            </li>
          </ul>
        </Section>
      </Card>

      <Card className="p-4">
        <Section title="Cruce">
          <p>
            Elegí <strong>salida</strong>, <strong>destino</strong> y <strong>barco</strong>, y la
            app evalúa la travesía a distintas horas de los próximos 7 días. Te muestra las{' '}
            <strong>salidas en orden cronológico</strong>, cada una con su semáforo, hora de llegada
            estimada y advertencias (rizos por ráfagas, niebla, marea, llegada de noche). La marcada
            como <strong>“mejor”</strong> es la recomendada. La tolerancia es la misma del panel.
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
