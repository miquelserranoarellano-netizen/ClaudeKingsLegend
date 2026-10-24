import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, Image as ImageIcon, ShieldAlert, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Container } from "@/components/layout/section";
import { mediaUrl, TeamLogo } from "@/components/ui/avatar";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DemoBadge, MatchStatusBadge } from "@/components/ui/status-badge";
import { confirmOpponentAction, markInProgressAction, validateReportAction } from "@/features/matches/actions";
import { DisputeForm, ResolveDisputeForm, ScheduleForm, ScoreForm } from "@/features/matches/components/match-forms";
import { getMatchDetail, type MatchDetail, type RosterPlayer } from "@/features/matches/queries";
import { roundLabel } from "@/features/tournaments/components/round-label";
import { getTournamentDetail, type ParticipantRef } from "@/features/tournaments/queries";
import { label } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/session";

type Params = { slug: string; id: string };

async function load(params: Promise<Params>, searchParams: Promise<{ codigo?: string }>) {
  const [{ slug, id }, { codigo }] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) return null;
  const viewer = await getCurrentUser();
  const detail = await getTournamentDetail(slug, viewer, codigo ?? null);
  if (!detail) return null;
  const match = await getMatchDetail(id, detail, viewer);
  return match ? { detail, match, viewer } : null;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ codigo?: string }> }): Promise<Metadata> {
  const data = await load(params, searchParams);
  if (!data) return { title: "Partido no encontrado", robots: { index: false } };
  const { match, detail } = data;
  return {
    title: `${match.a?.name ?? "Por decidir"} vs ${match.b?.name ?? "Por decidir"} · ${detail.tournament.name}`,
    robots: detail.tournament.visibility === "private" ? { index: false } : undefined,
  };
}

function SideHeader({ p, dead, won, align }: { p: ParticipantRef | null; dead: boolean; won: boolean; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:flex-row sm:gap-4", align === "right" ? "sm:flex-row-reverse sm:text-right" : "sm:text-left")}>
      <TeamLogo name={p?.name ?? "?"} tag={p?.tag} mediaId={p?.logoMediaId} size="lg" className={cn(won && "ring-4 ring-trophy/40")} />
      <div className="w-full min-w-0 sm:w-auto">
        <p className={cn("display line-clamp-2 text-lg leading-tight break-words uppercase sm:text-3xl", !won && "text-ink-2")}>
          {p ? p.href ? <Link href={p.href} className="hover:text-brand">{p.name}</Link> : p.name : dead ? "BYE" : "Por decidir"}
        </p>
        {p?.seed && <p className="text-xs text-ink-3">Semilla {p.seed}</p>}
      </div>
    </div>
  );
}

function Roster({ title, players, mvp }: { title: string; players: RosterPlayer[]; mvp: string | null }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold tracking-wide text-ink-3 uppercase">{title}</p>
      {players.length === 0 ? (
        <p className="text-sm text-ink-3">—</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {players.map((pl) => (
            <li key={pl.userId} className="flex items-center gap-2">
              {pl.isPublic ? <Link href={`/jugadores/${pl.handle}`} className="font-semibold hover:text-brand">{pl.displayName}</Link> : <span className="font-semibold">{pl.displayName}</span>}
              {pl.riotId && <span className="text-xs text-ink-3">{pl.riotId}</span>}
              {pl.isSubstitute && <Badge>Suplente</Badge>}
              {mvp === pl.userId && (
                <Badge tone="trophy">
                  <Star aria-hidden className="size-3" /> MVP
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Evidence({ items }: { items: MatchDetail["results"][number]["evidence"] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((e) =>
        e.mediaId ? (
          <li key={e.id}>
            <a href={mediaUrl(e.mediaId)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:bg-surface-2">
              <ImageIcon aria-hidden className="size-3.5" /> Captura
            </a>
          </li>
        ) : (
          <li key={e.id}>
            <a href={e.url!} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:bg-surface-2">
              <ExternalLink aria-hidden className="size-3.5" /> Enlace externo
            </a>
          </li>
        ),
      )}
    </ul>
  );
}

export default async function MatchPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ codigo?: string }> }) {
  const data = await load(params, searchParams);
  if (!data) notFound();
  const { detail, match: d } = data;
  const t = detail.tournament;
  const m = d.match;
  const decided = m.status === "confirmed";
  const aWon = decided && m.winnerId === m.participantAId;
  const bWon = decided && m.winnerId === m.participantBId;
  const both = !!m.participantAId && !!m.participantBId;
  const inProgress = t.status === "in_progress";
  const openDispute = d.disputes.find((x) => x.status === "open");
  const pending = d.results.filter((r) => r.status === "pending");
  const ownPending = d.viewer.side ? pending.find((r) => r.side === d.viewer.side) : undefined;
  const opponentPending = d.viewer.side ? pending.find((r) => r.side && r.side !== d.viewer.side) : undefined;
  const reportable = inProgress && both && ["pending", "scheduled", "in_progress", "awaiting_validation"].includes(m.status);
  const names = { a: d.a?.name ?? "Lado A", b: d.b?.name ?? "Lado B" };
  const players = [...d.rosterA.map((p) => ({ userId: p.userId, displayName: p.displayName, side: "a" as const })), ...d.rosterB.map((p) => ({ userId: p.userId, displayName: p.displayName, side: "b" as const }))];
  const playerName = (id: string | null) => (id ? (d.playerNames.get(id) ?? "—") : null);

  return (
    <Container className="py-8">
      <Link href={`/torneos/${t.slug}?vista=partidos`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-3 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {t.name}
      </Link>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/50 px-5 py-3 text-sm">
          <span className="font-semibold">
            {roundLabel(d.roundName)} · al mejor de {m.bestOf}
          </span>
          <span className="flex items-center gap-2">
            {t.isDemo && <DemoBadge />}
            {m.isBye ? <Badge>BYE</Badge> : <MatchStatusBadge status={m.status} />}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-8 sm:gap-4 sm:px-8">
          <SideHeader p={d.a} dead={m.slotADead} won={aWon} align="left" />
          <div className="shrink-0 text-center">
            {decided && !m.isBye ? (
              <p className="display text-4xl tabular sm:text-6xl">
                <span className={aWon ? "text-ink" : "text-ink-3"}>{m.scoreA}</span>
                <span className="mx-1 text-ink-3 sm:mx-2">:</span>
                <span className={bWon ? "text-ink" : "text-ink-3"}>{m.scoreB}</span>
              </p>
            ) : (
              <p className="display text-3xl text-ink-3">VS</p>
            )}
            {m.isForfeit && <p className="mt-1 text-xs text-ink-3">Incomparecencia</p>}
          </div>
          <SideHeader p={d.b} dead={m.slotBDead} won={bWon} align="right" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-line px-5 py-3 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock aria-hidden className="size-4 text-ink-3" /> {m.scheduledAt ? formatDateTime(m.scheduledAt) : "Sin fecha programada"}
          </span>
          {m.mvpUserId && (
            <span className="inline-flex items-center gap-1.5">
              <Star aria-hidden className="size-4 text-trophy" /> MVP: <strong>{playerName(m.mvpUserId)}</strong>
            </span>
          )}
          {m.confirmedAt && !m.isBye && <span className="text-ink-3">Confirmado el {formatDateTime(m.confirmedAt)}</span>}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {d.games.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Partidas" />
              <ol className="divide-y divide-line">
                {d.games.map((g) => (
                  <li key={g.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-ink-3">Partida {g.gameNumber}</span>
                    <span className="font-semibold">Gana {g.winnerId === m.participantAId ? names.a : names.b}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card>
            <CardHeader title="Plantillas" />
            <CardBody className="grid gap-6 sm:grid-cols-2">
              <Roster title={names.a} players={d.rosterA} mvp={m.mvpUserId} />
              <Roster title={names.b} players={d.rosterB} mvp={m.mvpUserId} />
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Historial de resultados" description="Cada resultado comunicado, validado o corregido, con quién lo hizo." />
            {d.results.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-3">Todavía no se ha comunicado ningún resultado.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {d.results.map((r) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        {names.a} <span className="font-display text-lg tabular">{r.scoreA}-{r.scoreB}</span> {names.b}
                        {r.isForfeit && <span className="ml-2 text-xs text-ink-3">(incomparecencia)</span>}
                      </p>
                      <Badge tone={r.status === "accepted" ? "open" : r.status === "pending" ? "warning" : "neutral"}>{label("resultStatus", r.status)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-3">
                      {r.side ? `Comunicado por ${r.reporterName ?? "—"} (${names[r.side]})` : `Introducido por la organización (${r.reporterName ?? "—"})`} · {formatDateTime(r.createdAt)}
                      {r.opponentConfirmedAt && ` · El rival está de acuerdo (${r.confirmerName ?? "—"})`}
                    </p>
                    {r.mvpUserId && <p className="mt-1 text-xs text-ink-2">MVP propuesto: {playerName(r.mvpUserId)}</p>}
                    {r.notes && <p className="mt-2 text-sm whitespace-pre-line text-ink-2">{r.notes}</p>}
                    {d.viewer.canSeePrivate && <Evidence items={r.evidence} />}
                    {r.status === "pending" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {d.viewer.canManage && inProgress && !openDispute && (
                          <ActionButton action={validateReportAction} fields={{ matchId: m.id, version: String(m.version), resultId: r.id }} size="sm">
                            <CheckCircle2 aria-hidden className="size-4" /> Validar este resultado
                          </ActionButton>
                        )}
                        {d.viewer.side && r.side && r.side !== d.viewer.side && !r.opponentConfirmedAt && (
                          <ActionButton action={confirmOpponentAction} fields={{ resultId: r.id }} size="sm" variant="outline">
                            Estoy de acuerdo
                          </ActionButton>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {d.disputes.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Disputas" />
              <ul className="divide-y divide-line">
                {d.disputes.map((x) => (
                  <li key={x.id} className="space-y-2 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-semibold">
                        <ShieldAlert aria-hidden className="size-4 text-danger" /> Abierta por {x.openerName ?? "—"}
                      </p>
                      <Badge tone={x.status === "open" ? "danger" : "neutral"}>{label("disputeStatus", x.status)}</Badge>
                    </div>
                    <p className="text-sm whitespace-pre-line text-ink-2">{d.viewer.canSeePrivate || x.status !== "open" ? x.reason : "Incidencia en revisión."}</p>
                    {d.viewer.canSeePrivate && <Evidence items={x.evidence} />}
                    {x.resolution && (
                      <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                        <strong>Resolución ({x.resolverName ?? "organización"}):</strong> {x.resolution}
                      </p>
                    )}
                    {x.status === "open" && d.viewer.canManage && <ResolveDisputeForm disputeId={x.id} />}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {d.viewer.side && reportable && !openDispute && (
            <Card>
              <CardHeader title={ownPending ? "Cambiar tu resultado" : "Comunicar resultado"} description={ownPending ? "Sustituirá al que enviaste." : "Lo validará la organización."} />
              <CardBody className="py-5">
                <ScoreForm mode="report" matchId={m.id} version={m.version} bestOf={m.bestOf} names={names} players={players} />
              </CardBody>
            </Card>
          )}
          {d.viewer.side && reportable && !openDispute && (
            <Card>
              <CardHeader title="Abrir disputa" description="Si algo no ha ido bien: incomparecencia, error en el resultado, conducta…" />
              <CardBody className="py-5">
                <DisputeForm matchId={m.id} resultId={opponentPending?.id ?? null} />
              </CardBody>
            </Card>
          )}

          {d.viewer.canManage && (
            <>
              {inProgress && !decided && m.status !== "void" && (
                <Card>
                  <CardHeader title="Horario" />
                  <CardBody className="space-y-4 py-5">
                    <ScheduleForm matchId={m.id} version={m.version} scheduledAt={m.scheduledAt} />
                    {both && ["pending", "scheduled"].includes(m.status) && (
                      <ActionButton action={markInProgressAction} fields={{ matchId: m.id, version: String(m.version) }} variant="ghost" size="sm">
                        Marcar como en juego
                      </ActionButton>
                    )}
                  </CardBody>
                </Card>
              )}
              {inProgress && both && !decided && m.status !== "void" && !openDispute && (
                <Card>
                  <CardHeader title="Registrar resultado" description="Lo confirma directamente y hace avanzar el cuadro." />
                  <CardBody className="py-5">
                    <ScoreForm mode="manual" matchId={m.id} version={m.version} bestOf={m.bestOf} names={names} players={players} />
                  </CardBody>
                </Card>
              )}
              {decided && !m.isBye && (t.status === "in_progress" || t.status === "completed") && (
                <Card className="border-danger/30">
                  <CardHeader title="Corregir resultado" description="Solo si el siguiente partido del ganador no se ha jugado. Queda auditado." />
                  <CardBody className="py-5">
                    <ScoreForm
                      mode="correct"
                      matchId={m.id}
                      version={m.version}
                      bestOf={m.bestOf}
                      names={names}
                      players={players}
                      initial={{ scoreA: m.scoreA, scoreB: m.scoreB, isForfeit: m.isForfeit, mvpUserId: m.mvpUserId }}
                    />
                  </CardBody>
                </Card>
              )}
            </>
          )}

          {!d.viewer.side && !d.viewer.canManage && reportable && (
            <Card>
              <CardBody className="text-sm text-ink-3">Los capitanes de los dos equipos comunican el resultado y la organización lo valida.</CardBody>
            </Card>
          )}
        </aside>
      </div>
    </Container>
  );
}
