'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Panel' },
  { href: '/alertas', label: 'Alertas' },
  { href: '/cruce', label: 'Cruce' },
  { href: '/perfil', label: 'Mi perfil' },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="bg-mar-800 text-white shadow">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex items-center gap-2 py-3">
          <span className="text-xl">⛵</span>
          <span className="font-semibold tracking-tight">Regatas</span>
          <span className="text-mar-200 text-sm hidden sm:inline">· Asistente Náutico</span>
        </div>
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-2 text-sm rounded-t-md whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-slate-50 text-mar-800 font-medium'
                    : 'text-mar-100 hover:bg-mar-700'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
