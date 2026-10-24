import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "brand" | "open" | "upcoming" | "live" | "finished" | "warning" | "danger" | "trophy" | "night";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  brand: "bg-brand-soft text-brand-ink",
  open: "bg-open-soft text-open",
  upcoming: "bg-upcoming-soft text-upcoming",
  live: "bg-live-soft text-live",
  finished: "bg-finished-soft text-finished",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  trophy: "bg-trophy-soft text-trophy",
  night: "bg-night text-white",
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
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide uppercase",
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 animate-pulse-dot rounded-full bg-current" />}
      {children}
    </span>
  );
}
