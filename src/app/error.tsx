"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Container } from "@/components/layout/section";
import { Button, ButtonLink } from "@/components/ui/button";

/** Error inesperado al cargar una página. No muestra detalles internos: solo una referencia para soporte. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="flex flex-col items-center py-24 text-center">
      <span className="flex size-14 rotate-45 items-center justify-center border border-danger/60 bg-night shadow-[0_0_24px_-6px_rgb(255_107_107/0.6)]">
        <TriangleAlert aria-hidden className="size-6 -rotate-45 text-danger" />
      </span>
      <h1 className="display mt-6 text-4xl uppercase">Algo ha fallado</h1>
      <p className="mt-2 max-w-md text-ink-3">No hemos podido cargar esta página. Vuelve a intentarlo en un momento.</p>
      {error.digest && <p className="mt-2 text-xs text-ink-3">Referencia: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw aria-hidden className="size-4" /> Reintentar
        </Button>
        <ButtonLink href="/" variant="outline">Ir al inicio</ButtonLink>
      </div>
    </Container>
  );
}
