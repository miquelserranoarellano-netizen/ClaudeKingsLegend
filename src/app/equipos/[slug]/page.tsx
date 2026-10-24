import { Crown, History, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/section";
import { Avatar, mediaUrl, TeamLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DemoBadge } from "@/components/ui/status-badge";
import { getTeamBySlug, getTeamMembers, teamHistory } from "@/features/teams/queries";
import { label } from "@/i18n";
import { formatDate } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/session";

const STATUS_TEXT = { draft: "Borrador", published: "Próximamente", in_progress: "En curso", completed: "Finalizado", cancelled: "Cancelado" } as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const team = await getTeamBySlug((await params).slug);
  if (!team) return { title: "Equipo no encontrado", robots: { index: false } };
  const description = team.team.description ?? `[${team.team.tag}] ${team.team.name}: plantilla e historial competitivo en Kings Legend.`;
  return {
    title: `${team.team.name} [${team.team.tag}]`,
    description,
    alternates: { canonical: `/equipos/${team.team.slug}` },
    robots: team.team.isDemo || team.team.status !== "active" ? { index: false } : undefined,
    openGraph: { title: team.team.name, description, images: team.team.logoMediaId ? [{ url: mediaUrl(team.team.logoMediaId) }] : undefined },
  };
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getTeamBySlug((await params).slug);
  if (!data) notFound();
  const { team } = data;
  const [members, history, viewer] = await Promise.all([getTeamMembers(team.id, team.captainId), teamHistory(team.id), getCurrentUser()]);
  const wins = history.reduce((s, h) => s + h.wins, 0);
  const losses = history.reduce((s, h) => s + h.losses, 0);
  const titles = history.filter((h) => h.isChampion).length;
  const isMember = !!viewer && members.some((m) => m.userId === viewer.id);

  return (
    <>
      <section className="hatch border-b border-line bg-surface">
        <Container className="flex flex-wrap items-center gap-6 py-10">
          <TeamLogo name={team.name} tag={team.tag} mediaId={team.logoMediaId} size="xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-[0.2em] text-brand uppercase">[{team.tag}]</p>
            <h1 className="display text-4xl uppercase sm:text-5xl">{team.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-3">
              Capitán: <Link href={`/jugadores/${data.captainHandle}`} className="font-semibold text-ink hover:text-brand">{data.captainName}</Link> · desde {formatDate(team.createdAt)}
              {team.isDemo && <DemoBadge />}
              {team.status === "disbanded" && <Badge tone="danger">Disuelto</Badge>}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-6 text-center">
            {[
              { label: "Títulos", value: titles },
              { label: "Victorias", value: wins },
              { label: "Derrotas", value: losses },
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
          {team.description && (
            <Card>
              <CardHeader title="Sobre el equipo" />
              <CardBody><p className="text-sm whitespace-pre-line text-ink-2">{team.description}</p></CardBody>
            </Card>
          )}
          <Card className="overflow-hidden">
            <CardHeader title={`Plantilla (${members.length})`} />
            <ul className="divide-y divide-line">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={m.displayName} mediaId={m.avatarMediaId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {m.isPublic ? <Link href={`/jugadores/${m.handle}`} className="hover:text-brand">{m.displayName}</Link> : m.displayName}
                      {m.isCaptain && <Crown aria-label="Capitán" className="size-4 text-trophy" />}
                    </p>
                    <p className="text-xs text-ink-3">
                      {m.riotId ?? "Sin Riot ID"}
                      {m.mainPosition ? ` · ${label("position", m.mainPosition as "top")}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          {isMember && (
            <ButtonLink href={`/dashboard/equipos/${team.id}`} variant="outline" className="w-full">
              Gestionar el equipo
            </ButtonLink>
          )}
        </div>
        <Card className="overflow-hidden">
          <CardHeader title="Historial competitivo" />
          {history.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={History} title="Sin torneos todavía" compact>
                Cuando el equipo participe en torneos públicos, su recorrido aparecerá aquí.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.tournamentId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/torneos/${h.slug}`} className="font-semibold hover:text-brand">{h.name}</Link>
                    <p className="text-xs text-ink-3">
                      {label("format", h.format)} · {formatDate(h.startsAt)} · {STATUS_TEXT[h.status]}
                    </p>
                  </div>
                  {h.isChampion && (
                    <Badge tone="trophy">
                      <Trophy aria-hidden className="size-3" /> Campeón
                    </Badge>
                  )}
                  <span className="text-sm font-semibold tabular">{h.wins}V · {h.losses}D</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Container>
    </>
  );
}
