import { Compass } from "lucide-react";
import { Container } from "@/components/layout/section";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center py-24 text-center">
      <p className="display text-gold text-9xl tabular opacity-80">404</p>
      <span className="mt-6 flex size-14 rotate-45 items-center justify-center border border-brand/60 bg-night shadow-[0_0_24px_-6px_rgb(200_170_110/0.7)]">
        <Compass aria-hidden className="size-6 -rotate-45 text-brand-strong" />
      </span>
      <h1 className="display mt-6 text-4xl uppercase">Esta página no existe</h1>
      <span aria-hidden className="ornament ornament-center mt-3 w-48">
        <span className="ornament-line-left" />
      </span>
      <p className="mt-2 max-w-md text-ink-3">Puede que el enlace esté mal, que el torneo sea privado o que ya no esté disponible.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Ir al inicio</ButtonLink>
        <ButtonLink href="/torneos" variant="outline">Ver torneos</ButtonLink>
      </div>
    </Container>
  );
}
