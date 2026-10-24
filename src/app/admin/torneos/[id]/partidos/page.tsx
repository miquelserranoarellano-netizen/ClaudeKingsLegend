import { AlertTriangle, ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MatchStatusBadge } from "@/components/ui/status-badge";
import { RoundScheduleForm } from "@/features/matches/components/round-schedule-form";
import { roundLabel } from "@/features/tournaments/components/round-label";
import { getCompetition, getManagedTournament } from "@/features/tournaments/queries";
import { formatDateTime } from "@/lib/format";
import { requireAdminArea } from "@/server/auth/session";

export const metadata = { title: "Partidos" };

export default async function AdminMatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminArea(`/admin/torneos/${id}/partidos`);
  if (!z.uuid().safeParse(id).success) notFound();
  const managed = await getManagedTournament(id, user);
  if (!managed) notFound();
  const { tournament: t } = managed;
  const rounds = t.status === "in_progress" || t.status === "completed" ? await getCompetition(t.id, t.format) : [];
  const all = rounds.flatMap((r) => r.matches);
  const awaiting = all.filter((m) => m.status === "awaiting_validation").length;
  const disputed = all.filter((m) => m.status === "disputed").length;
  const link = (matchId: string) => `/torneos/${t.slug}/partidos/${matchId}${t.accessCode ? `?codigo=${t.accessCode}` : ""}`;

  return (
    <>
      <Link href={`/admin/torneos/${t.id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-3 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {t.name}
      </Link>
      <DashboardTitle title="Partidos" description="Programa horarios por ronda o partido a partido. Desde cada partido validas, registras o corriges resultados y resuelves disputas." />
      {rounds.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin partidos todavía">
          Se generan al iniciar la competición desde la ficha del torneo.
        </EmptyState>
      ) : (
        <>
          {(awaiting > 0 || disputed > 0) && (
            <p className="mb-6 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
              <AlertTriangle aria-hidden className="size-4" />
              {awaiting > 0 && `${awaiting} resultado(s) pendiente(s) de validar. `}
              {disputed > 0 && `${disputed} partido(s) con disputa abierta.`}
            </p>
          )}
          <div className="space-y-6">
            {rounds.map((round) => {
              const visible = round.matches.filter((m) => m.status !== "void");
              if (visible.length === 0) return null;
              const open = visible.some((m) => m.status !== "confirmed");
              return (
                <Card key={round.id} className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                    <h2 className="font-display text-lg font-bold uppercase">
                      {roundLabel(round.name)} <span className="text-sm font-semibold text-ink-3 normal-case">· Bo{round.bestOf}</span>
                    </h2>
                    {open && t.status === "in_progress" && <RoundScheduleForm roundId={round.id} />}
                  </div>
                  <ul className="divide-y divide-line">
                    {visible.map((m) => (
                      <li key={m.id}>
                        <Link href={link(m.id)} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-surface-2/60 sm:grid-cols-[1fr_12rem_10rem]">
                          <span className="min-w-0 truncate text-sm">
                            <strong>{m.a?.name ?? (m.aDead ? "BYE" : "Por decidir")}</strong>
                            <span className="mx-2 text-ink-3">{m.status === "confirmed" && !m.isBye ? `${m.scoreA}-${m.scoreB}` : "vs"}</span>
                            <strong>{m.b?.name ?? (m.bDead ? "BYE" : "Por decidir")}</strong>
                          </span>
                          <span className="hidden text-sm text-ink-3 tabular sm:block">{m.scheduledAt ? formatDateTime(m.scheduledAt) : "Sin fecha"}</span>
                          <span className="justify-self-end">{m.isBye ? <span className="text-xs text-ink-3">BYE</span> : <MatchStatusBadge status={m.status} />}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
