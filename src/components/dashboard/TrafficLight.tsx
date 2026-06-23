import type { TrafficLevel } from '@/lib/types/forecast';

const CONFIG: Record<TrafficLevel, { bg: string; text: string; label: string; emoji: string }> = {
  verde: { bg: 'bg-semaforo-verde', text: 'text-white', label: 'Navegable', emoji: '🟢' },
  'poco-viento': { bg: 'bg-semaforo-pocoViento', text: 'text-white', label: 'Poco viento', emoji: '🔵' },
  amarillo: { bg: 'bg-semaforo-amarillo', text: 'text-white', label: 'Precaución', emoji: '🟡' },
  rojo: { bg: 'bg-semaforo-rojo', text: 'text-white', label: 'No recomendable', emoji: '🔴' },
};

export function TrafficLight({ level, size = 'md' }: { level: TrafficLevel; size?: 'sm' | 'md' }) {
  const c = CONFIG[level];
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${c.bg} ${c.text} ${pad}`}>
      {c.label}
    </span>
  );
}

export function levelDot(level: TrafficLevel) {
  return CONFIG[level].emoji;
}
