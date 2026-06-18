'use client';

import type { SavedLocation } from '@/lib/profile/types';

export function LocationPicker({
  label = 'Lugar:',
  locations,
  value,
  onChange,
}: {
  label?: string;
  locations: SavedLocation[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (locations.length === 0) return null;
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 focus:border-mar-500 focus:outline-none"
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
