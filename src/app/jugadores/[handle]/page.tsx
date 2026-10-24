import { History, Star, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/section";
import { Avatar, mediaUrl, TeamLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicProfile } from "@/features/profiles/queries";
import { label } from "@/i18n";
import { formatDate } from "@/lib/format";
import { formatRiotId } from "@/lib/lol";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const profile = await getPublicProfile((await params).handle);
  if (!profile) return { title: "Jugador no encontrado", robots: { index: false } };
  return {
    title: profile.displayName,
    description: profile.bio ?? `${profile.displayName} en Kings Legend: equipos, torneos y estadísticas.`,
    alternates: { canonical: `/jugadores/${profile.handle}` },
    openGraph: { title: profile.displayName, images: profile.avatarMediaId ? [{ url: mediaUrl(profile.avatarMediaId) }] : undefined },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ handle: string }> }) {
  const profile = await getPublicProfile((await params).handle);
  if (!profile) notFound();
  const riotId = formatRiotId(profile.riotGameName, profile.riotTagLine);
  const winRate = profile.stats.played > 0 ? Math.round((profile.stats.wins / profile.stats.played) * 100) : null;

  return (
    <>
      <section className="hatch border-b border-line bg-surface">
        <Container className="flex flex-wrap items-center gap-6 py-10">
          <Avatar name={profile.displayName} mediaId={profile.avatarMediaId} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="display text-4xl uppercase sm:text-5xl">{profile.displayName}</h1>
            <p className="mt-1 text-sm text-ink-3">
              @{profile.handle}
              {riotId && <> · <span className="font-semibold text-ink-2">{riotId}</span> <span className="text-xs">(declarado, no verificado)</span></>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.region && <Badge>{profile.region}</Badge>}
              {profile.mainPosition && <Badge tone="brand">{label("position", profile.mainPosition)}</Badge>}
              <Badge>En Kings Legend desde {formatDate(profile.memberSince)}</Badge>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-6 text-center">
            {[
              { label: "Partidos", value: String(profile.stats.played) },
              { label: "Victorias", value: winRate === null ? "—" : `${winRate}%` },
              { label: "MVP", value: String(profile.stats.mvps) },
            ].map((s) => (
              <div key={s.label}>
                <dt className="text-xs tracking-wide text-ink-3 uppercase">{s.label}</dt>
                <dd className="display text-4xl tabular">{s.value}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>
      <Container className="grid gap-6 py-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-6">
          {profile.bio && (
            <Card>
              <CardHeader title="Biografía" />
              <CardBody><p className="text-sm whitespace-pre-line text-ink-2">{profile.bio}</p></CardBody>
            </Card>
          )}
          <Card className="overflow-hidden">
            <CardHeader title="Equipos" />
            {profile.teams.length === 0 ? (
              <CardBody><p className="text-sm text-ink-3">No pertenece a ningún equipo.</p></CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {profile.teams.map((team) => (
                  <li key={team.id}>
                    <Link href={`/equipos/${team.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                      <TeamLogo name={team.name} tag={team.tag} mediaId={team.logoMediaId} size="sm" />
                      <span className="font-semibold">{team.name}</span>
                      {team.captainId === profile.userId && <Badge tone="trophy">Capitán</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="overflow-hidden">
          <CardHeader title="Historial de torneos" />
          {profile.history.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={History} title="Sin torneos todavía" compact>
                Aquí aparecerán los torneos públicos en los que juegue.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {profile.history.map((h) => (
                <li key={h.tournamentId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/torneos/${h.slug}`} className="font-semibold hover:text-brand">{h.name}</Link>
                    <p className="text-xs text-ink-3">{h.teamName ? `Con ${h.teamName}` : "Individual"} · {formatDate(h.startsAt)}</p>
                  </div>
                  {h.isChampion && (
                    <Badge tone="trophy"><Trophy aria-hidden className="size-3" /> Campeón</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          {profile.stats.mvps > 0 && (
            <p className="flex items-center gap-2 border-t border-line px-4 py-3 text-sm text-ink-2">
              <Star aria-hidden className="size-4 text-trophy" /> {profile.stats.mvps} veces MVP
            </p>
          )}
        </Card>
      </Container>
    </>
  );
}
