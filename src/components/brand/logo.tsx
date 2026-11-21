import { cn } from "@/lib/cn";

/**
 * Logotipo de Kings Legend: un escudo hexagonal con borde de oro, una corona forjada y una gema cian en el
 * centro. Diseño propio (no reproduce marcas de terceros). Para cambiarlo basta con este componente y
 * `src/app/icon.svg`, que repite el emblema.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 36" className={cn("h-9 w-8", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id="kl-logo-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7e6bd" />
          <stop offset="0.5" stopColor="#c8aa6e" />
          <stop offset="1" stopColor="#8a6a33" />
        </linearGradient>
        <linearGradient id="kl-logo-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#15263f" />
          <stop offset="1" stopColor="#010a13" />
        </linearGradient>
      </defs>
      <path d="M16 1 30.5 9v18L16 35 1.5 27V9z" fill="url(#kl-logo-night)" stroke="url(#kl-logo-gold)" strokeWidth="1.6" />
      <path d="M16 4.3 27.6 10.9v14.2L16 31.7 4.4 25.1V10.9z" fill="none" stroke="#c8aa6e" strokeOpacity="0.35" strokeWidth="0.6" />
      <g transform="translate(0 1.4)">
        <path d="M8.2 22.4v-9l4 3.6L16 10.2l3.8 6.8 4-3.6v9z" fill="url(#kl-logo-gold)" />
        <rect x="8.2" y="23.6" width="15.6" height="2.2" fill="url(#kl-logo-gold)" />
        <path d="M16 15.4l1.7 2.6L16 20.6 14.3 18z" fill="#0ac8b9" stroke="#010a13" strokeWidth="0.5" />
      </g>
    </svg>
  );
}

/** Solo la corona, para usos decorativos (marcas de agua). */
export function CrownMark({ className }: { className?: string }) {
  return (
    <svg viewBox="6 6 20 21" className={className} aria-hidden fill="currentColor">
      <path d="M7 21.5V11.2l4.6 4.1L16 7.5l4.4 7.8 4.6-4.1v10.3z" />
      <rect x="7" y="23" width="18" height="2.6" rx="0.6" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-gold font-epic text-[1.4rem] font-extrabold tracking-[0.02em] uppercase italic">Kings</span>
          <span className="mt-0.5 font-display text-[0.62rem] font-bold tracking-[0.46em] text-ink-2 uppercase">Legend</span>
        </span>
      )}
    </span>
  );
}
