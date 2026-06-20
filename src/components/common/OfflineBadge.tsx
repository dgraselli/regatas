'use client';

export function OfflineBadge({ fetchedAt }: { fetchedAt?: string }) {
  if (!fetchedAt) return null;
  let label = '';
  try {
    const d = new Date(fetchedAt);
    label = d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    label = fetchedAt;
  }
  return (
    <span className="text-xs text-slate-400">Datos del {label}</span>
  );
}
