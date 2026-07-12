import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { NavBar } from '@/components/common/NavBar';
import { BetaBanner } from '@/components/common/BetaBanner';
import { Analytics, OpenPanelAnalytics } from '@/components/common/Analytics';
import { FeedbackButton } from '@/components/common/FeedbackButton';
import { APP_VERSION } from '@/lib/version';

const SITE_URL = 'https://regatas.com.ar';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Regatas — Pronóstico de navegación a vela en el Río de la Plata',
    template: '%s · Regatas',
  },
  description:
    'Pronóstico náutico para velear en el Río de la Plata: semáforo de navegabilidad por día, alertas de sudestada y bajante, niebla y planificador de cruce a Colonia y Montevideo. Para veleristas de Argentina y Uruguay.',
  keywords: [
    'pronóstico navegación Río de la Plata',
    'pronóstico náutico',
    'navegar a vela',
    'veleros Río de la Plata',
    'viento Río de la Plata',
    'sudestada alerta',
    'bajante Río de la Plata',
    'cruce a Colonia en velero',
    'cruce a Montevideo en velero',
    'clima para navegar',
    'náutica Argentina',
    'náutica Uruguay',
  ],
  applicationName: 'Regatas',
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/manifest.webmanifest`,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Regatas' },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Regatas',
    locale: 'es_AR',
    url: SITE_URL,
    title: 'Regatas — Pronóstico de navegación a vela en el Río de la Plata',
    description:
      'Semáforo de navegabilidad por día, alertas de sudestada y bajante, niebla y planificador de cruce a Colonia y Montevideo. Para veleristas de Argentina y Uruguay.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Regatas — asistente náutico del Río de la Plata',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Regatas — Pronóstico de navegación a vela en el Río de la Plata',
    description:
      'Semáforo de navegabilidad, alertas de sudestada/bajante y cruce a Colonia y Montevideo, para veleristas de Argentina y Uruguay.',
    images: ['/og-image.png'],
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Regatas',
  url: SITE_URL,
  applicationCategory: 'TravelApplication',
  operatingSystem: 'Web',
  inLanguage: 'es',
  description:
    'Pronóstico de navegación a vela en el Río de la Plata: semáforo de navegabilidad, alertas de sudestada/bajante y niebla, y planificador de cruce a Colonia y Montevideo.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'ARS' },
  areaServed: [
    { '@type': 'Country', name: 'Argentina' },
    { '@type': 'Country', name: 'Uruguay' },
  ],
};

export const viewport: Viewport = {
  themeColor: '#1d63d8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        <Analytics />
        <OpenPanelAnalytics />
        <Providers>
          <div className="min-h-screen flex flex-col">
            <NavBar />
            {/* TEMPORAL — quitar al salir de etapa de pruebas */}
            <BetaBanner />
            <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6">{children}</main>
            <footer className="text-center text-xs text-slate-400 py-6 space-y-1">
              <p className="mx-auto max-w-2xl">
                <strong>Regatas</strong> — pronóstico de navegación a vela en el Río de la
                Plata: semáforo de navegabilidad por día, alertas de sudestada y bajante,
                niebla y planificador de cruce a Colonia y Montevideo. Para veleristas de
                Argentina y Uruguay.
              </p>
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
