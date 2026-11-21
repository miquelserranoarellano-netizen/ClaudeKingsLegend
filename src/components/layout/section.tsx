import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6", className)}>{children}</div>;
}

/**
 * Título de sección al estilo de los juegos de fantasía: antetítulo pequeño en cian, título épico en serif
 * cursiva y un ornamento dorado debajo. Enlace opcional a «ver todo».
 */
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
    <div className={cn("mb-6 flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <Heading id={id} className="display text-3xl text-ink uppercase sm:text-4xl">
          {title}
        </Heading>
        <span aria-hidden className="ornament mt-2.5" />
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 font-display text-sm font-bold tracking-[0.14em] text-brand uppercase hover:text-brand-strong"
        >
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
    <div className="relative overflow-hidden bg-night/60">
      <div aria-hidden className="hatch absolute inset-0 [mask-image:linear-gradient(180deg,black,transparent)]" />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(40rem_16rem_at_15%_0%,rgb(10_200_185/0.10),transparent_70%),radial-gradient(36rem_18rem_at_90%_100%,rgb(200_170_110/0.10),transparent_70%)]"
      />
      <Container className="relative py-10 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            <h1 className="display text-4xl text-ink uppercase sm:text-5xl">{title}</h1>
            <span aria-hidden className="ornament mt-3" />
            {description && <p className="mt-3 max-w-2xl text-ink-2">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </Container>
      <div aria-hidden className="gold-rule opacity-60" />
    </div>
  );
}
