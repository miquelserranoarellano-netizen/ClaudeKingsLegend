import { CloseSection } from "@/components/landing/close-section";
import { type LandingAction, LandingHero } from "@/components/landing/hero";
import { LandingHeading } from "@/components/landing/landing-heading";
import { LeagueNow } from "@/components/landing/league-now";
import { ProductSection } from "@/components/landing/product-section";
import { type AnnouncedPrize, RewardsSection } from "@/components/landing/rewards-section";
import { StepsSection } from "@/components/landing/steps-section";
import { Container } from "@/components/layout/section";
import { DemoBadge } from "@/components/ui/status-badge";
import { canCreateTournament } from "@/domain/permissions";
import { listPublishedAnnouncements } from "@/features/announcements/service";
import { latestResults, teamRanking } from "@/features/competition/queries";
import { TournamentCard } from "@/features/tournaments/components/tournament-card";
import { TournamentSpotlight } from "@/features/tournaments/components/tournament-spotlight";
import { featuredTournaments, type TournamentCard as Card } from "@/features/tournaments/queries";
import { cn } from "@/lib/cn";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** El mismo torneo puede salir en dos listas: se queda la primera aparición. */
function unique(items: Card[]): Card[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/**
 * Portada de venta (diseño según las skills de `.claude/skills` y taste-skill): primer pantallazo con arte
 * del juego, la plataforma, los premios, los pasos, la liga al día (solo si hay datos) y un cierre con la
 * misma acción principal. Todo lo que cuenta sale de la base de datos o de funciones que existen.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  const [open, live, upcoming, results, ranking, news] = await Promise.all([
    featuredTournaments("open", 3),
    featuredTournaments("live", 3),
    featuredTournaments("upcoming", 3),
    latestResults(5),
    teamRanking(5),
    listPublishedAnnouncements({ pageSize: 3 }),
  ]);

  const tournaments = unique([...open, ...live, ...upcoming]);
  const spotlight = tournaments[0] ?? null;
  const prizes: AnnouncedPrize[] = tournaments
    .filter((t) => t.prizeDescription?.trim())
    .slice(0, 3)
    .map((t) => ({ slug: t.slug, tournament: t.name, prize: t.prizeDescription!.trim(), isDemo: t.isDemo }));
  const hasDemo = tournaments.some((t) => t.isDemo) || results.some((m) => m.tournament.isDemo);

  // La acción principal se escribe igual en la cabecera de la web, aquí arriba y en el cierre.
  const organizer = user ? canCreateTournament(user) : false;
  const main: LandingAction = !user
    ? { href: "/registro", label: "Apúntate gratis" }
    : organizer
      ? { href: "/admin/torneos/nuevo", label: "Crea un torneo" }
      : { href: "/torneos?estado=open", label: "Inscribe a tu equipo" };
  const browse: LandingAction = { href: "/torneos", label: "Ver torneos" };

  return (
    <>
      <LandingHero main={main} secondary={browse} status={<HeroStatus spotlight={spotlight} />} aside={spotlight ? <TournamentSpotlight tournament={spotlight} /> : undefined} />

      {hasDemo && (
        <Container className="pt-6">
          <p className="flex items-center gap-2 rounded-sm border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning">
            <DemoBadge /> Parte de lo que ves son datos de demostración generados para desarrollo: no son resultados reales.
          </p>
        </Container>
      )}

      <ProductSection />
      <RewardsSection prizes={prizes} />
      <StepsSection signedIn={Boolean(user)} />

      {tournaments.length > 0 && (
        <section aria-labelledby="torneos-title" className="border-t border-line py-24">
          <Container>
            <LandingHeading id="torneos-title" eyebrow="Calendario" title="Torneos en marcha" link={{ href: "/torneos", label: "Ver todos los torneos" }} />
            <div className={cn("mt-10 grid gap-5 sm:grid-cols-2", tournaments.length >= 3 && "lg:grid-cols-3")}>
              {tournaments.slice(0, 3).map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          </Container>
        </section>
      )}

      <LeagueNow results={results} ranking={ranking} news={news.items} />

      <CloseSection main={main} secondary={organizer ? browse : { href: "/contacto", label: "Organiza un torneo" }} />
    </>
  );
}

/** Línea de estado sobre el titular: si hay un torneo en juego, abierto o anunciado, lo dice con su color. */
function HeroStatus({ spotlight }: { spotlight: Card | null }) {
  if (!spotlight) {
    return <p className="eyebrow [text-shadow:0_1px_10px_rgb(1_10_19/0.9)]">League of Legends · Torneos y ligas</p>;
  }
  const { text, tone } =
    spotlight.category === "live"
      ? { text: "Torneo en directo", tone: "text-live" }
      : spotlight.category === "open"
        ? { text: "Inscripción abierta", tone: "text-open" }
        : { text: "Próximo torneo anunciado", tone: "text-upcoming" };
  return (
    <p className={cn("inline-flex flex-wrap items-center gap-x-2.5 font-display text-sm font-bold tracking-[0.2em] uppercase [text-shadow:0_1px_10px_rgb(1_10_19/0.9)]", tone)}>
      <span aria-hidden className="size-2 animate-pulse-dot rounded-full bg-current shadow-[0_0_10px_currentColor]" />
      {text}
      <span className="text-ink-2">· League of Legends</span>
    </p>
  );
}
