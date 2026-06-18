'use client';

import { CLUBS } from '@/lib/config/clubs';

export function LocationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-slate-500">Lugar:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 focus:border-mar-500 focus:outline-none"
      >
        {CLUBS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
