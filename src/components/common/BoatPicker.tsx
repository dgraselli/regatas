'use client';

import type { Boat } from '@/lib/profile/types';

export function BoatPicker({
  label = 'Barco:',
  boats,
  value,
  onChange,
}: {
  label?: string;
  boats: Boat[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (boats.length === 0) return null;
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 focus:border-mar-500 focus:outline-none"
      >
        {boats.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.lengthFt}′)
          </option>
        ))}
      </select>
    </label>
  );
}
