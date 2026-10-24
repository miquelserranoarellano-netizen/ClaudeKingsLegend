import { cn } from "@/lib/cn";

/**
 * Logotipo PROVISIONAL de Kings Legend: una corona geométrica en un sello con la esquina recortada.
 * Es un diseño propio y sencillo, pensado para sustituirse: basta con cambiar este componente (y
 * `src/app/icon.svg`, que repite el sello).
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d="M0 4a4 4 0 0 1 4-4h20l8 8v20a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill="var(--color-brand)" />
      <path d="M7 21.5V11.2l4.6 4.1L16 7.5l4.4 7.8 4.6-4.1v10.3z" fill="#fff" />
      <rect x="7" y="23" width="18" height="2.6" rx="0.6" fill="#fff" />
      <circle cx="16" cy="17.4" r="1.6" fill="var(--color-brand)" />
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
          <span className="font-display text-[1.35rem] font-extrabold tracking-tight text-ink uppercase">Kings</span>
          <span className="font-display text-[0.7rem] font-bold tracking-[0.32em] text-brand uppercase">Legend</span>
        </span>
      )}
    </span>
  );
}
