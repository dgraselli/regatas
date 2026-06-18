import { compass } from '@/lib/format';

/**
 * Flecha que apunta en la dirección HACIA la que sopla el viento.
 * `deg` es la dirección DESDE la que viene (convención meteorológica),
 * por eso la flecha apunta a deg+180.
 */
export function WindArrow({ deg, className = '' }: { deg: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={`Viento del ${compass(deg)}`}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        style={{ transform: `rotate(${deg + 180}deg)` }}
        className="text-mar-600"
        aria-hidden
      >
        <path d="M12 2 L18 20 L12 16 L6 20 Z" fill="currentColor" />
      </svg>
      <span className="text-xs text-slate-500">{compass(deg)}</span>
    </span>
  );
}
