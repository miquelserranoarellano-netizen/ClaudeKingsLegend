import Link from "next/link";
import type { ReactNode } from "react";
import { CrownMark } from "@/components/brand/logo";

/** Marco de las pantallas de cuenta: formulario a la izquierda y panel de marca a la derecha. */
export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-0 px-4 py-10 sm:px-6 md:grid-cols-[1fr_0.85fr] md:py-16">
      <div className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8 md:rounded-r-none">
        <h1 className="display text-4xl uppercase">{title}</h1>
        {description && <p className="mt-2 text-sm text-ink-3">{description}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t border-line pt-5 text-sm text-ink-3">{footer}</div>}
      </div>
      <aside className="chamfer relative hidden overflow-hidden rounded-r-card bg-night p-8 text-white md:block">
        <CrownMark className="absolute -right-10 -bottom-8 size-72 text-white opacity-[0.07]" />
        <p className="text-xs font-bold tracking-[0.18em] text-white/60 uppercase">Kings Legend</p>
        <p className="display mt-3 text-4xl uppercase">
          Tu equipo.
          <br />
          Tu cuadro.
          <br />
          <span className="text-brand">Tu leyenda.</span>
        </p>
        <ul className="relative mt-8 space-y-3 text-sm text-white/80">
          <li>· Inscribe a tu equipo con titulares y suplentes.</li>
          <li>· Comunica resultados con capturas como evidencia.</li>
          <li>· Sigue el cuadro y la clasificación en directo.</li>
        </ul>
        <p className="relative mt-10 text-xs text-white/50">
          ¿Dudas? <Link href="/contacto" className="underline underline-offset-4 hover:text-white">Escríbenos</Link>.
        </p>
      </aside>
    </div>
  );
}
