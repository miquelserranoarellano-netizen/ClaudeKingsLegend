import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Cabecera de sección de la portada: antetítulo, titular y, si hace falta, un enlace con verbo y objeto. */
export function LandingHeading({ id, eyebrow, title, link }: { id: string; eyebrow: string; title: ReactNode; link?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="headline mt-3 text-4xl text-ink sm:text-5xl">
          {title}
        </h2>
      </div>
      {link && (
        <Link
          href={link.href}
          className="group inline-flex items-center gap-1 font-display text-sm font-bold tracking-[0.14em] text-brand uppercase hover:text-brand-strong"
        >
          {link.label}
          <ArrowRight aria-hidden className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
