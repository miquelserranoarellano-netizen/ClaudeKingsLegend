import Link from "next/link";
import type { ReactNode } from "react";
import { RuneEmblem } from "@/components/brand/rune-emblem";

/** Marco de las pantallas de cuenta: formulario a la izquierda y panel de marca a la derecha. */
export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-0 px-4 py-10 sm:px-6 md:grid-cols-[1fr_0.85fr] md:py-16">
      <div className="frame-gold rounded-card bg-surface/95 p-6 sm:p-8 md:rounded-r-none">
        <h1 className="display text-4xl uppercase">{title}</h1>
        <span aria-hidden className="ornament mt-3" />
        {description && <p className="mt-2 text-sm text-ink-3">{description}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t border-line pt-5 text-sm text-ink-3">{footer}</div>}
      </div>
      <aside className="relative hidden overflow-hidden rounded-r-card border border-l-0 border-brand/30 bg-night p-8 text-white md:block">
        <div aria-hidden className="hatch absolute inset-0 opacity-80" />
        <div className="pointer-events-none absolute -right-32 -bottom-36 size-96 opacity-45">
          <RuneEmblem />
        </div>
        <p className="eyebrow relative">Kings Legend</p>
        <p className="display relative mt-3 text-4xl uppercase">
          Tu equipo.
          <br />
          Tu cuadro.
          <br />
          <span className="text-gold">Tu leyenda.</span>
        </p>
        <ul className="relative mt-8 space-y-3 text-sm text-ink-2">
          {["Inscribe a tu equipo con titulares y suplentes.", "Comunica resultados con capturas como evidencia.", "Sigue el cuadro y la clasificación en directo."].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-brand" />
              {item}
            </li>
          ))}
        </ul>
        <p className="relative mt-10 text-xs text-ink-3">
          ¿Dudas?{" "}
          <Link href="/contacto" className="text-hex underline underline-offset-4 hover:text-hex-strong">
            Escríbenos
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}
