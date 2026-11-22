import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";

/**
 * Marco de las pantallas de cuenta (acceso, registro, recuperar…): una tarjeta centrada y sencilla, sin
 * nada que distraiga del formulario. La portada es la que vende; aquí se entra rápido.
 */
export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative isolate px-4 py-12 sm:py-20">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(38rem_18rem_at_50%_0%,rgb(200_170_110/0.07),transparent_70%)]" />
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
          <LogoMark className="h-8 w-7" />
          <h1 className="headline mt-5 text-4xl text-ink">{title}</h1>
          {description && <p className="mt-2 text-sm text-ink-3">{description}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-line pt-5 text-sm text-ink-3">{footer}</div>}
        </div>
        <p className="mt-6 text-center text-xs text-ink-3">
          ¿Dudas?{" "}
          <Link href="/contacto" className="text-hex underline underline-offset-4 hover:text-hex-strong">
            Escríbenos
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
