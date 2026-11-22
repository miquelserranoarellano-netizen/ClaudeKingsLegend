import { Crown, Megaphone, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/section";
import { TeamLogo } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { podiumClass } from "@/components/ui/podium";
import { DemoBadge } from "@/components/ui/status-badge";
import type { listPublishedAnnouncements } from "@/features/announcements/service";
import { MatchList } from "@/features/competition/components/match-list";
import type { latestResults, teamRanking } from "@/features/competition/queries";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { LandingHeading } from "./landing-heading";

type Results = Awaited<ReturnType<typeof latestResults>>;
type Ranking = Awaited<ReturnType<typeof teamRanking>>;
type News = Awaited<ReturnType<typeof listPublishedAnnouncements>>["items"];

/**
 * La liga, al día: últimos resultados, ranking y noticias. Solo se pintan los bloques con contenido, y la
 * sección entera desaparece si no hay ninguno (una portada de venta no enseña cajas vacías).
 */
export function LeagueNow({ results, ranking, news }: { results: Results; ranking: Ranking; news: News }) {
  const blocks = [results.length > 0 && "results", ranking.length > 0 && "ranking", news.length > 0 && "news"].filter(Boolean);
  if (blocks.length === 0) return null;

  return (
    <section aria-labelledby="liga-title" className="border-t border-line bg-night/50 py-24">
      <Container>
        <LandingHeading id="liga-title" eyebrow="Ahora mismo" title="La liga, al día" link={{ href: "/ranking", label: "Ver el ranking completo" }} />
        <div className={cn("mt-10 grid gap-6", blocks.length === 3 && "lg:grid-cols-3", blocks.length === 2 && "lg:grid-cols-2")}>
          {results.length > 0 && (
            <Card className="overflow-hidden">
              <BlockTitle icon={<Trophy aria-hidden className="size-5 text-brand" />}>Últimos resultados</BlockTitle>
              <MatchList items={results} mode="results" />
            </Card>
          )}

          {ranking.length > 0 && (
            <Card className="overflow-hidden">
              <BlockTitle icon={<Crown aria-hidden className="size-5 text-brand" />}>Mejores equipos</BlockTitle>
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
            </Card>
          )}

          {news.length > 0 && (
            <Card className="overflow-hidden">
              <BlockTitle icon={<Megaphone aria-hidden className="size-5 text-brand" />}>Noticias</BlockTitle>
              <ul className="divide-y divide-line">
                {news.map((item) => (
                  <li key={item.id} className="relative px-4 py-3.5 transition-colors hover:bg-white/[0.03]">
                    <p className="flex items-center gap-2 text-xs text-ink-3">
                      {formatDate(item.publishedAt)}
                      {item.tournamentName && <span>· {item.tournamentName}</span>}
                      {item.isDemo && <DemoBadge />}
                    </p>
                    <h4 className="mt-1 font-semibold">
                      <Link href={`/noticias/${item.id}`} className="after:absolute after:inset-0 hover:text-brand">
                        {item.title}
                      </Link>
                    </h4>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink-3">{item.body}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </Container>
    </section>
  );
}

function BlockTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 border-b border-line px-4 py-3 font-display text-lg font-bold tracking-[0.06em] uppercase">
      {icon}
      {children}
    </h3>
  );
}
