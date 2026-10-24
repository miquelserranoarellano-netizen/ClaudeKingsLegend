import { Compass } from "lucide-react";
import { Container } from "@/components/layout/section";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center py-24 text-center">
      <p className="display text-8xl text-surface-3 tabular">404</p>
      <Compass aria-hidden className="mt-4 size-10 text-brand" />
      <h1 className="display mt-4 text-4xl uppercase">Esta página no existe</h1>
      <p className="mt-2 max-w-md text-ink-3">Puede que el enlace esté mal, que el torneo sea privado o que ya no esté disponible.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Ir al inicio</ButtonLink>
        <ButtonLink href="/torneos" variant="outline">Ver torneos</ButtonLink>
      </div>
    </Container>
  );
}
