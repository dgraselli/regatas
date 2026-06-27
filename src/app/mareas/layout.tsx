import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mareas del Río de la Plata: sudestada, bajante y nivel del agua',
  description:
    'Nivel del agua observado y alertas de marea meteorológica (sudestada y bajante) para navegar en el Río de la Plata, con ventanas horarias. Costa argentina y uruguaya.',
  alternates: { canonical: '/mareas/' },
};

export default function MareasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
