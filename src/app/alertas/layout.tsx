import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Alertas de sudestada, bajante y niebla en el Río de la Plata',
  description:
    'Alertas de marea meteorológica (sudestada y bajante) y de niebla para navegar en el Río de la Plata, con nivel de agua observado y ventanas horarias. Costa argentina y uruguaya.',
  alternates: { canonical: '/alertas/' },
};

export default function AlertasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
