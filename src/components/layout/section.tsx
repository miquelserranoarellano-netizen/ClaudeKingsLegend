import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6", className)}>{children}</div>;
}

/** Título de sección con la barra de acento de la marca y un enlace opcional a «ver todo». */
export function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel = "Ver todo",
  id,
  className,
  as: Heading = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  href?: string;
  linkLabel?: string;
  id?: string;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4", className)}>
      <div className="border-l-4 border-brand pl-3">
        {eyebrow && <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">{eyebrow}</p>}
        <Heading id={id} className="display text-3xl text-ink uppercase sm:text-4xl">
          {title}
        </Heading>
      </div>
      {href && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-brand">
          {linkLabel}
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/** Cabecera de página interior. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="hatch border-b border-line bg-surface">
      <Container className="py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 border-l-4 border-brand pl-4">
            {eyebrow && <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">{eyebrow}</p>}
            <h1 className="display text-4xl text-ink uppercase sm:text-5xl">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </Container>
    </div>
  );
}
