import { Crown, ListOrdered, Trophy } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/section";
import { DemoBadge } from "@/components/ui/status-badge";
import { ArtImage } from "./art-image";
import { ART } from "./lol-art";

export interface AnnouncedPrize {
  slug: string;
  tournament: string;
  prize: string;
  isDemo: boolean;
}

/**
 * Recompensas: los premios que anuncian los torneos (de la base de datos, nunca inventados) y lo que gana
 * siempre el campeón dentro de Kings Legend (el título en su perfil y su puesto en el ranking).
 */
export function RewardsSection({ prizes }: { prizes: AnnouncedPrize[] }) {
  return (
    <section aria-labelledby="premios-title" className="border-y border-line bg-night py-24 md:py-32">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-brand/30 lg:aspect-[5/6]">
          <ArtImage art={ART.rewards} className="object-[30%_center]" />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(1_10_19/0.55),transparent_45%)]" />
        </div>

        <div>
          <p className="eyebrow">Recompensas</p>
          <h2 id="premios-title" className="headline mt-3 text-4xl text-ink sm:text-5xl">
            Premios reales para <span className="text-gold block">el equipo campeón</span>
          </h2>
          <p className="mt-4 max-w-lg text-lg text-ink-2">
            Cada torneo anuncia sus premios en su ficha antes de abrir la inscripción: sabes por qué compites desde el primer día.
          </p>

          <div className="mt-8 rounded-card border border-trophy/30 bg-trophy-soft p-5">
            <p className="font-display text-xs font-bold tracking-[0.2em] text-trophy uppercase">Premios anunciados</p>
            {prizes.length > 0 ? (
              <ul className="mt-3 divide-y divide-trophy/15">
                {prizes.map((p) => (
                  <li key={p.slug} className="flex items-start gap-3 py-3 first:pt-1 last:pb-0">
                    <Trophy aria-hidden className="mt-0.5 size-5 shrink-0 text-trophy" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link href={`/torneos/${p.slug}`} className="font-semibold text-ink hover:text-brand-strong">
                          {p.tournament}
                        </Link>
                        {p.isDemo && <DemoBadge />}
                      </p>
                      <p className="text-sm text-ink-2">{p.prize}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-2">Los premios de cada torneo aparecerán aquí en cuanto la organización los publique.</p>
            )}
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="flex gap-3">
              <Crown aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-strong" />
              <div>
                <h3 className="font-display text-lg font-bold tracking-[0.06em] uppercase">El título, para siempre</h3>
                <p className="mt-0.5 text-sm text-ink-3">El campeón suma un título en el perfil del equipo y en su historial.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <ListOrdered aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-strong" />
              <div>
                <h3 className="font-display text-lg font-bold tracking-[0.06em] uppercase">Un puesto en el ranking</h3>
                <p className="mt-0.5 text-sm text-ink-3">Los títulos y las victorias confirmadas ordenan el ranking de equipos.</p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
