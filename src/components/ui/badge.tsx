import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "brand" | "open" | "upcoming" | "live" | "finished" | "warning" | "danger" | "trophy" | "night";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line-strong bg-surface-2 text-ink-2",
  brand: "border-brand/45 bg-brand-soft text-brand-ink",
  open: "border-open/40 bg-open-soft text-open",
  upcoming: "border-upcoming/40 bg-upcoming-soft text-upcoming",
  live: "border-live/45 bg-live-soft text-live",
  finished: "border-finished/35 bg-finished-soft text-finished",
  warning: "border-warning/40 bg-warning-soft text-warning",
  danger: "border-danger/40 bg-danger-soft text-danger",
  trophy: "border-trophy/45 bg-trophy-soft text-trophy",
  night: "border-line-strong bg-night text-ink",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  /** Punto animado (para «en directo»). */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-display text-[0.72rem] leading-4 font-bold tracking-[0.12em] uppercase backdrop-blur-sm",
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 animate-pulse-dot rounded-full bg-current" />}
      {children}
    </span>
  );
}
