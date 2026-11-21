import { CalendarClock, ClipboardCheck, Crown, Megaphone, Swords, Trophy, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { RuneEmblem } from "@/components/brand/rune-emblem";
import { podiumClass } from "@/components/ui/podium";
import { Container, SectionHeading } from "@/components/layout/section";
import { TeamLogo } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DemoBadge } from "@/components/ui/status-badge";
import { canCreateTournament } from "@/domain/permissions";
import { listPublishedAnnouncements } from "@/features/announcements/service";
import { MatchList } from "@/features/competition/components/match-list";
import { latestResults, platformStats, teamRanking, upcomingMatches } from "@/features/competition/queries";
import { TournamentCard } from "@/features/tournaments/components/tournament-card";
import { featuredTournaments } from "@/features/tournaments/queries";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: UserPlus, title: "Crea tu cuenta", text: "Elige tu nombre visible y añade tu Riot ID en el perfil. Es gratis." },
  { icon: Users, title: "Forma tu equipo", text: "Crea un equipo con nombre, etiqueta y logotipo e invita a tus jugadores." },
  { icon: ClipboardCheck, title: "Inscríbete", text: "Elige un torneo abierto, marca titulares y suplentes y envía la inscripción." },
  { icon: Swords, title: "Compite", text: "Consulta tus partidos, comunica el resultado y sigue el cuadro en directo." },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const [stats, open, upcoming, live, results, nextMatches, ranking, news] = await Promise.all([
    platformStats(),
    featuredTournaments("open", 3),
    featuredTournaments("upcoming", 3),
    featuredTournaments("live", 3),
    latestResults(5),
    upcomingMatches(5),
    teamRanking(5),
    listPublishedAnnouncements({ pageSize: 3 }),
  ]);
  const nothingYet = stats.tournaments === 0;
  const hasDemo = [...open, ...upcoming, ...live].some((t) => t.isDemo) || results.some((m) => m.tournament.isDemo);

  return (
    <>
      {/* Hero: portada «de videojuego» con el emblema rúnico y el marcador de la plataforma. */}
      <section className="relative isolate overflow-hidden bg-night">
        <div aria-hidden className="hatch absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_80%_at_70%_40%,black,transparent)]" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(46rem_30rem_at_74%_38%,rgb(10_200_185/0.16),transparent_70%),radial-gradient(40rem_24rem_at_8%_100%,rgb(200_170_110/0.13),transparent_70%)]"
        />
        <div aria-hidden className="absolute -top-1/3 left-[58%] -z-10 h-[170%] w-28 rotate-[24deg] bg-linear-to-b from-transparent via-brand/12 to-transparent blur-2xl" />
        <div aria-hidden className="absolute -top-1/3 left-[70%] -z-10 h-[170%] w-10 rotate-[24deg] bg-linear-to-b from-transparent via-hex/10 to-transparent blur-xl" />

        <Container className="relative grid items-center gap-10 pt-12 pb-10 md:grid-cols-[1.2fr_1fr] md:pt-16">
          <div className="relative z-10">
            <p className="eyebrow inline-flex items-center gap-2.5">
              <span aria-hidden className="size-1.5 rotate-45 bg-hex shadow-[0_0_8px_rgb(10_200_185/0.9)]" />
              League of Legends · Competición amateur
            </p>
            <h1 className="display mt-4 text-5xl text-ink uppercase drop-shadow-[0_4px_24px_rgb(0_0_0/0.6)] sm:text-6xl lg:text-7xl">
              Compite. Gana.
              <br />
              <span className="text-gold">Hazte leyenda.</span>
            </h1>
            <span aria-hidden className="ornament mt-6" />
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              Torneos y ligas con inscripción de equipos, cuadros que avanzan solos, calendario de partidos y
              clasificaciones calculadas al momento.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <ButtonLink href="/torneos" size="lg">
                Ver torneos
              </ButtonLink>
              {user ? (
                canCreateTournament(user) ? (
                  <ButtonLink href="/admin/torneos/nuevo" size="lg" variant="outline">
                    Crear un torneo
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/dashboard/equipos/nuevo" size="lg" variant="outline">
                    Crear un equipo
                  </ButtonLink>
                )
              ) : (
                <ButtonLink href="/registro" size="lg" variant="outline">
                  Crear cuenta
                </ButtonLink>
              )}
            </div>
          </div>

          {/* En móvil queda de fondo, tras el título, para que los botones se vean sin desplazarse. */}
          <div className="pointer-events-none absolute -top-8 -right-28 w-72 opacity-25 sm:-right-20 sm:w-80 md:relative md:top-auto md:right-auto md:mx-auto md:w-full md:max-w-[29rem] md:opacity-100">
            <RuneEmblem />
          </div>
        </Container>

        {/* Marcador de la plataforma */}
        <Container className="relative pb-12 md:pb-16">
          <dl className="frame-gold grid grid-cols-2 bg-night-2/70 backdrop-blur-sm md:grid-cols-4">
            {[
              { label: "Torneos y ligas", value: stats.tournaments },
              { label: "Inscripciones abiertas", value: stats.open },
              { label: "Equipos activos", value: stats.teams },
              { label: "Partidos jugados", value: stats.matches },
            ].map((s, index) => (
              <div
                key={s.label}
                className={cn(
                  "flex flex-col-reverse items-center gap-1 px-4 py-5 text-center",
                  index % 2 === 1 && "border-l border-brand/20",
                  index >= 2 && "border-t border-brand/20 md:border-t-0",
                  index === 2 && "md:border-l",
                )}
              >
                <dt className="font-display text-xs font-bold tracking-[0.2em] text-ink-3 uppercase">{s.label}</dt>
                <dd className="display text-gold text-5xl tabular sm:text-6xl">{formatNumber(s.value)}</dd>
              </div>
            ))}
          </dl>
          {nothingYet && (
            <p className="mt-4 text-center text-sm text-ink-3">Todavía no se ha publicado ningún torneo. El primero puede ser el tuyo.</p>
          )}
        </Container>
        <div aria-hidden className="gold-rule" />
      </section>

      {hasDemo && (
        <Container className="pt-6">
          <p className="flex items-center gap-2 rounded-sm border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning">
            <DemoBadge /> Parte de lo que ves son datos de demostración generados para desarrollo: no son resultados reales.
          </p>
        </Container>
      )}

      {nothingYet ? (
        <Container className="pt-14">
          <EmptyState
            icon={Trophy}
            title="Aún no hay torneos"
            action={
              user && canCreateTournament(user) ? (
                <ButtonLink href="/admin/torneos/nuevo">Crear el primer torneo</ButtonLink>
              ) : (
                <>
                  <ButtonLink href={user ? "/dashboard/equipos/nuevo" : "/registro"}>{user ? "Crear tu equipo" : "Crear cuenta"}</ButtonLink>
                  <ButtonLink href="/contacto" variant="outline">
                    Quiero organizar
                  </ButtonLink>
                </>
              )
            }
          >
            Cuando la organización publique el primero, aparecerá aquí con sus fechas y plazas. Mientras tanto,
            puedes crear tu cuenta y tu equipo para estar listo.
          </EmptyState>
        </Container>
      ) : (
        <>
          <TournamentRow title="Inscripciones abiertas" eyebrow="Apúntate" items={open} href="/torneos?estado=open" empty="Ahora mismo no hay ningún torneo con la inscripción abierta." />
          <TournamentRow title="En curso" eyebrow="En directo" items={live} href="/torneos?estado=live" empty="No hay ninguna competición en marcha." />
          <TournamentRow title="Próximamente" eyebrow="Calendario" items={upcoming} href="/torneos?estado=upcoming" empty="No hay torneos anunciados para las próximas fechas." />
        </>
      )}

      <Container className="mt-16 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase">
              <Trophy aria-hidden className="size-5 text-brand" /> Últimos resultados
            </h2>
          </div>
          {results.length > 0 ? (
            <MatchList items={results} mode="results" />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-ink-3">Todavía no hay resultados confirmados.</p>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase">
              <CalendarClock aria-hidden className="size-5 text-brand" /> Próximos partidos
            </h2>
          </div>
          {nextMatches.length > 0 ? (
            <MatchList items={nextMatches} mode="upcoming" />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-ink-3">No hay partidos programados.</p>
          )}
        </Card>
      </Container>

      <Container className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section aria-labelledby="ranking-title">
          <SectionHeading id="ranking-title" eyebrow="Ranking" title="Mejores equipos" href="/ranking" />
          <Card className="overflow-hidden">
            {ranking.length > 0 ? (
              <ol className="divide-y divide-line">
                {ranking.map((team, index) => (
                  <li key={team.teamId} className={cn("flex items-center gap-3 px-4 py-3", index === 0 && "bg-[linear-gradient(90deg,rgb(200_170_110/0.12),transparent_60%)]")}>
                    <span className={cn("w-6 text-center font-display text-xl font-extrabold tabular", podiumClass(index + 1))}>{index + 1}</span>
                    <TeamLogo name={team.name} tag={team.tag} mediaId={team.logoMediaId} size="sm" />
                    <Link href={`/equipos/${team.slug}`} className="min-w-0 flex-1 truncate font-semibold hover:text-brand">
                      {team.name}
                    </Link>
                    {team.isDemo && <DemoBadge />}
                    {team.titles > 0 && (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-trophy" title="Títulos">
                        <Crown aria-hidden className="size-4" /> {team.titles}
                      </span>
                    )}
                    <span className="text-sm text-ink-3 tabular">
                      {team.wins}V · {team.losses}D
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-ink-3">El ranking aparecerá cuando se confirmen los primeros partidos.</p>
            )}
          </Card>
        </section>

        <section aria-labelledby="news-title">
          <SectionHeading id="news-title" eyebrow="Novedades" title="Noticias" href="/noticias" />
          <div className="space-y-3">
            {news.items.length > 0 ? (
              news.items.map((item) => (
                <Card key={item.id} className="relative p-4 hover:shadow-lift">
                  <p className="flex items-center gap-2 text-xs text-ink-3">
                    {formatDate(item.publishedAt)}
                    {item.tournamentName && <span>· {item.tournamentName}</span>}
                    {item.isDemo && <DemoBadge />}
                  </p>
                  <h3 className="mt-1 font-semibold">
                    <Link href={`/noticias/${item.id}`} className="after:absolute after:inset-0 hover:text-brand">
                      {item.title}
                    </Link>
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-3">{item.body}</p>
                </Card>
              ))
            ) : (
              <EmptyState icon={Megaphone} title="Sin noticias" compact>
                Los anuncios de la organización aparecerán aquí.
              </EmptyState>
            )}
          </div>
        </section>
      </Container>

      <section className="relative mt-24 overflow-hidden bg-night/70" aria-labelledby="how-title">
        <div aria-hidden className="gold-rule" />
        <div aria-hidden className="hatch absolute inset-0 -z-10 opacity-70" />
        <Container className="py-16">
          <SectionHeading id="how-title" eyebrow="Cómo participar" title="De cero a la final en cuatro pasos" />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="group relative rounded-card border border-line bg-surface/80 p-6 transition-[border-color,box-shadow] duration-200 hover:border-brand/50 hover:shadow-lift"
              >
                <span className="text-gold absolute top-4 right-5 font-display text-5xl font-extrabold opacity-35 tabular" aria-hidden>
                  {index + 1}
                </span>
                <span className="flex size-12 rotate-45 items-center justify-center border border-brand/60 bg-night shadow-[0_0_22px_-6px_rgb(200_170_110/0.7)] transition-colors group-hover:border-brand-strong">
                  <step.icon aria-hidden className="size-5 -rotate-45 text-brand-strong" />
                </span>
                <h3 className="mt-6 font-display text-xl font-bold tracking-[0.06em] uppercase">{step.title}</h3>
                <p className="mt-1 text-sm text-ink-3">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={user ? "/dashboard" : "/registro"}>{user ? "Ir a mi panel" : "Empezar ahora"}</ButtonLink>
            <ButtonLink href="/terminos" variant="ghost">
              Leer las normas de la plataforma
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}

function TournamentRow({
  title,
  eyebrow,
  items,
  href,
  empty,
}: {
  title: string;
  eyebrow: string;
  items: Awaited<ReturnType<typeof featuredTournaments>>;
  href: string;
  empty: string;
}) {
  return (
    <Container className="mt-14">
      <section aria-label={title}>
        <SectionHeading eyebrow={eyebrow} title={title} href={items.length > 0 ? href : undefined} />
        {items.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        ) : (
          <p className="rounded-card border border-dashed border-line-strong bg-surface px-5 py-6 text-sm text-ink-3">{empty}</p>
        )}
      </section>
    </Container>
  );
}
