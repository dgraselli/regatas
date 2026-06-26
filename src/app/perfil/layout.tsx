import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mi perfil',
  description: 'Configurá tus barcos, lugares de amarra, tolerancia y preferencias de navegación.',
  alternates: { canonical: '/perfil/' },
  // Página de configuración del usuario: sin contenido útil para buscadores.
  robots: { index: false, follow: true },
};

export default function PerfilLayout({ children }: { children: React.ReactNode }) {
  return children;
}
