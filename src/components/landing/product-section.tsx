import { Camera, GitBranch, ListOrdered } from "lucide-react";
import { Container } from "@/components/layout/section";
import { ProductPreview } from "./product-preview";

/** Lo que hace la plataforma por la liga. Solo funciones que existen (ver docs/ESTADO.md). */
const FEATURES = [
  {
    icon: GitBranch,
    title: "Mueve el cuadro por ti",
    text: "Al validar un resultado, el ganador pasa de ronda y su próximo partido aparece en el calendario.",
  },
  {
    icon: Camera,
    title: "Valida cada resultado con capturas",
    text: "Los capitanes suben el marcador con pruebas y la organización lo confirma antes de que cuente.",
  },
  {
    icon: ListOrdered,
    title: "Calcula la clasificación al momento",
    text: "En las ligas, la tabla se rehace con cada partido, con los desempates a la vista.",
  },
];

export function ProductSection() {
  return (
    <section aria-labelledby="plataforma-title" className="py-24 md:py-32">
      <Container className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <p className="eyebrow">La plataforma</p>
          <h2 id="plataforma-title" className="headline mt-3 text-4xl text-ink sm:text-5xl">
            {/* Espacios que no parten: las líneas se cortan entre frases, nunca dejan una palabra sola. */}
            Una liga automática, de&nbsp;la&nbsp;inscripción a&nbsp;la&nbsp;final
          </h2>
          <p className="mt-4 max-w-lg text-lg text-ink-2">Kings Legend genera el cuadro, coloca a cada ganador y calcula la clasificación por ti.</p>
          <ul className="mt-9 space-y-6">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-sm border border-brand/40 bg-brand-soft text-brand-strong">
                  <f.icon aria-hidden className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold tracking-[0.06em] uppercase">{f.title}</h3>
                  <p className="mt-0.5 text-[0.95rem] text-ink-3">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <ProductPreview />
      </Container>
    </section>
  );
}
