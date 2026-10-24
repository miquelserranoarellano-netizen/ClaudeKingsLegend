import { Container } from "@/components/layout/section";

/** Esqueleto mientras carga una página: misma estructura aproximada, sin saltos al aparecer el contenido. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="border-b border-line bg-surface">
        <Container className="space-y-3 py-10">
          <div className="h-3 w-28 animate-pulse rounded bg-surface-3" />
          <div className="h-10 w-2/3 max-w-xl animate-pulse rounded bg-surface-3" />
          <div className="h-4 w-1/2 max-w-md animate-pulse rounded bg-surface-2" />
        </Container>
      </div>
      <Container className="grid gap-5 py-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="aspect-[16/7] animate-pulse bg-surface-3" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-surface-3" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </Container>
    </div>
  );
}
