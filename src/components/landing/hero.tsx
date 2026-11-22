import type { ReactNode } from "react";
import { Container } from "@/components/layout/section";
import { ButtonLink } from "@/components/ui/button";
import { ArtImage } from "./art-image";
import { ART } from "./lol-art";

export interface LandingAction {
  href: string;
  label: string;
}

/**
 * Primer pantallazo de la portada: arte del juego a sangre, qué es Kings Legend y para quién, la acción
 * principal y, si lo hay, el torneo que toca ahora (`aside`). Todo entra una sola vez al cargar, de arriba
 * abajo y con muy poco retraso entre piezas; nada se mueve al hacer scroll.
 */
export function LandingHero({ main, secondary, status, aside }: { main: LandingAction; secondary: LandingAction; status: ReactNode; aside?: ReactNode }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-night">
      <div aria-hidden className="absolute inset-0 -z-20">
        <ArtImage art={ART.hero} priority decorative className="animate-art object-[58%_20%] lg:object-[72%_20%]" />
      </div>
      {/* Velos para leer el texto: en el móvil desde abajo (el texto va abajo), en escritorio desde la izquierda. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,var(--color-night)_18%,rgb(1_10_19/0.85)_55%,rgb(1_10_19/0.62)_80%,rgb(1_10_19/0.32))] lg:bg-[linear-gradient(to_right,var(--color-night)_12%,rgb(1_10_19/0.86)_36%,rgb(1_10_19/0.25)_66%,rgb(1_10_19/0.05))]"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-linear-to-t from-page via-page/60 to-transparent" />

      <Container className="flex min-h-[calc(100svh-4rem)] flex-col justify-end gap-10 pt-36 pb-12 sm:pt-56 lg:min-h-[min(calc(100svh-4rem),56rem)] lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:pt-28 lg:pb-20">
        <div className="max-w-3xl">
          <div className="animate-enter">{status}</div>
          <h1 id="hero-title" className="headline mt-5 animate-enter text-[2.75rem] text-ink [animation-delay:60ms] sm:text-7xl lg:text-[4.25rem] xl:text-[5.25rem]">
            La liga de LoL por equipos <span className="text-gold block">con premios reales</span>
          </h1>
          <p className="mt-6 max-w-xl animate-enter text-lg text-ink-2 [animation-delay:120ms]">
            Torneos y ligas con cuadros que avanzan solos, resultados con pruebas y clasificación en directo. Forma tu
            equipo, apúntate y compite por el título.
          </p>
          <div className="mt-8 flex animate-enter flex-wrap gap-3 [animation-delay:180ms]">
            <ButtonLink href={main.href} size="lg">
              {main.label}
            </ButtonLink>
            <ButtonLink href={secondary.href} size="lg" variant="outline">
              {secondary.label}
            </ButtonLink>
          </div>
          <p className="mt-6 animate-enter text-sm text-ink-3 [animation-delay:240ms]">
            Gratis para jugadores y equipos · Eliminatoria, doble eliminación o liga
          </p>
        </div>
        {aside && <div className="w-full max-w-sm shrink-0 animate-enter [animation-delay:320ms]">{aside}</div>}
      </Container>
    </section>
  );
}
