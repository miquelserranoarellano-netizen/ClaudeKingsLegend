import Link from "next/link";
import { Container } from "@/components/layout/section";
import { ArtImage } from "./art-image";
import { LandingHeading } from "./landing-heading";
import { ART } from "./lol-art";

/** De la cuenta al primer partido: cada paso lleva a donde se hace. */
export function StepsSection({ signedIn }: { signedIn: boolean }) {
  const steps = [
    {
      title: "Crea tu cuenta",
      text: "Elige tu nombre y añade tu Riot ID al perfil. Es gratis.",
      href: signedIn ? "/dashboard/perfil" : "/registro",
    },
    {
      title: "Forma tu equipo",
      text: "Ponle nombre, etiqueta y escudo, e invita a tus compañeros.",
      href: "/dashboard/equipos/nuevo",
    },
    {
      title: "Inscríbete en un torneo",
      text: "Elige uno abierto, marca titulares y suplentes y envía la inscripción.",
      href: "/torneos?estado=open",
    },
    {
      title: "Juega y sube el resultado",
      text: "Consulta tus partidos, comunica el marcador y sigue el cuadro en directo.",
      href: "/torneos",
    },
  ];

  return (
    <section aria-labelledby="pasos-title" className="py-24 md:py-32">
      <Container>
        <LandingHeading id="pasos-title" eyebrow="Cómo se juega" title="De cero a la final en cuatro pasos" />
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title}>
              <Link
                href={step.href}
                className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-lift"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <ArtImage art={ART.steps[index]!} decorative className="object-[center_22%] transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
                  <div aria-hidden className="absolute inset-0 bg-linear-to-t from-surface via-surface/15 to-transparent" />
                  <span aria-hidden className="text-gold absolute bottom-2 left-5 font-display text-5xl font-extrabold tabular">
                    {index + 1}
                  </span>
                </div>
                <div className="flex flex-1 flex-col px-5 pt-2 pb-6">
                  <h3 className="font-display text-xl font-bold tracking-[0.05em] uppercase transition-colors group-hover:text-brand-strong">
                    <span className="sr-only">Paso {index + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink-3">{step.text}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
