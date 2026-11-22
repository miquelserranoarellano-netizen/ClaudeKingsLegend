import { Container } from "@/components/layout/section";
import { ButtonLink } from "@/components/ui/button";
import { ArtImage } from "./art-image";
import type { LandingAction } from "./hero";
import { ART } from "./lol-art";

/** Cierre de la portada: la acción principal otra vez, con las mismas palabras que arriba. */
export function CloseSection({ main, secondary }: { main: LandingAction; secondary: LandingAction }) {
  return (
    <section aria-labelledby="cierre-title" className="relative isolate overflow-hidden border-t border-line bg-night">
      <div aria-hidden className="absolute inset-0 -z-20">
        <ArtImage art={ART.close} decorative className="object-[50%_30%]" />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--color-night)_20%,rgb(1_10_19/0.8)_50%,rgb(1_10_19/0.35))]" />
      <Container className="py-28 md:py-40">
        <h2 id="cierre-title" className="headline max-w-2xl text-5xl text-ink sm:text-6xl">
          La próxima final puede ser <span className="text-gold block">la de tu equipo</span>
        </h2>
        <p className="mt-5 max-w-lg text-lg text-ink-2">Crea tu cuenta, forma tu equipo y apúntate al próximo torneo con la inscripción abierta.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={main.href} size="lg">
            {main.label}
          </ButtonLink>
          <ButtonLink href={secondary.href} size="lg" variant="outline">
            {secondary.label}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
