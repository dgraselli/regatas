import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { NavBar } from '@/components/common/NavBar';

export const metadata: Metadata = {
  title: 'Regatas — Asistente Náutico',
  description:
    'Pronóstico, semáforo de navegabilidad, alertas de sudestada/bajante y planificador del cruce La Plata → Colonia en el Río de la Plata.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Regatas' },
};

export const viewport: Viewport = {
  themeColor: '#1d63d8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <NavBar />
            <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6">{children}</main>
            <footer className="text-center text-xs text-slate-400 py-6">
              Datos: Open-Meteo · INA · SHN. Estimaciones orientativas — verificá siempre
              el pronóstico oficial antes de navegar.
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
