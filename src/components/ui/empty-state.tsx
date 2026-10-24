import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Estado vacío: explica qué falta y, si tiene sentido, ofrece la acción que lo resuelve. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
  compact = false,
}: {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "hatch flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface text-center",
        compact ? "gap-2 px-5 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="font-display text-xl font-bold tracking-tight text-ink uppercase">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-3">{children}</div>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
