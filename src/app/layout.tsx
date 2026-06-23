import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { NavBar } from '@/components/common/NavBar';
import { BetaBanner } from '@/components/common/BetaBanner';
import { Analytics } from '@/components/common/Analytics';
import { FeedbackButton } from '@/components/common/FeedbackButton';
import { APP_VERSION } from '@/lib/version';

export const metadata: Metadata = {
  title: 'Regatas — Asistente Náutico',
  description:
    'Pronóstico, semáforo de navegabilidad, alertas de sudestada/bajante y planificador del cruce La Plata → Colonia en el Río de la Plata.',
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/manifest.webmanifest`,
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
        <Analytics />
        <Providers>
          <div className="min-h-screen flex flex-col">
            <NavBar />
            {/* TEMPORAL — quitar al salir de etapa de pruebas */}
            <BetaBanner />
            <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6">{children}</main>
            <footer className="text-center text-xs text-slate-400 py-6 space-y-1">
              <p>
                Datos: Open-Meteo · INA · SHN. Estimaciones orientativas — verificá siempre
                el pronóstico oficial antes de navegar.
              </p>
              <p>
                <FeedbackButton /> · v{APP_VERSION}
              </p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
