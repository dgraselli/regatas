'use client';

import type { Caution } from '@/lib/profile/types';

const OPTS: { value: Caution; label: string }[] = [
  { value: 'prudente', label: 'Prudente' },
  { value: 'normal', label: 'Normal' },
  { value: 'audaz', label: 'Audaz' },
];

export function CautionPicker({
  label = 'Tolerancia:',
  value,
  onChange,
}: {
  label?: string;
  value: Caution;
  onChange: (c: Caution) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Caution)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 focus:border-mar-500 focus:outline-none"
      >
        {OPTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
