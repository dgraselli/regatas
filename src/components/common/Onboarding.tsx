'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';

export function Onboarding({ title, body }: { title: string; body: string }) {
  return (
    <Card className="p-8 text-center">
      <div className="text-4xl mb-3">⛵</div>
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">{body}</p>
      <Link
        href="/perfil"
        className="inline-block mt-4 rounded-lg bg-mar-600 text-white px-4 py-2 text-sm font-medium hover:bg-mar-700"
      >
        Configurar mi perfil
      </Link>
    </Card>
  );
}
