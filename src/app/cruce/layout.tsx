import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Planificador de cruce a vela: Colonia y Montevideo',
  description:
    'Planificá el cruce a vela del Río de la Plata entre dos puntos (por ejemplo a Colonia o Montevideo): mejor hora de salida según viento, niebla y marea, con semáforo y hora de llegada estimada.',
  alternates: { canonical: '/cruce/' },
};

export default function CruceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
