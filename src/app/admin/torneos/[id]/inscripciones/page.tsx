import { ArrowLeft, ClipboardList } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { TeamLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RegistrationBadge } from "@/components/ui/status-badge";
import { ReviewForm } from "@/features/registrations/components/review-form";
import { tournamentRegistrationList } from "@/features/registrations/queries";
import { getManagedTournament } from "@/features/tournaments/queries";
import { formatDateTime } from "@/lib/format";
import { requireAdminArea } from "@/server/auth/session";

export const metadata = { title: "Inscripciones" };

const GROUPS = [
  { status: "pending", title: "Pendientes de revisión" },
  { status: "waitlisted", title: "Lista de espera" },
  { status: "approved", title: "Aprobadas" },
  { status: "rejected", title: "Rechazadas" },
  { status: "withdrawn", title: "Retiradas" },
] as const;

export default async function RegistrationsAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminArea(`/admin/torneos/${id}/inscripciones`);
  if (!z.uuid().safeParse(id).success) notFound();
  const managed = await getManagedTournament(id, user);
  if (!managed) notFound();
  const { tournament: t, rules } = managed;
  const registrations = await tournamentRegistrationList(t.id);
  const approved = registrations.filter((r) => r.status === "approved").length;
  const editable = t.status === "published";

  return (
    <>
      <Link href={`/admin/torneos/${t.id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-3 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {t.name}
      </Link>
      <DashboardTitle
        title="Inscripciones"
        description={`${approved} de ${t.maxParticipants} plazas ocupadas (mínimo ${t.minParticipants}). ${rules.waitlistEnabled ? "Con lista de espera." : "Sin lista de espera."}${editable ? "" : " La competición ya ha empezado: las inscripciones no se pueden modificar."}`}
      />
      {registrations.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin inscripciones">
          Cuando los equipos se inscriban aparecerán aquí para revisarlas.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {GROUPS.map((group) => {
            const items = registrations.filter((r) => r.status === group.status);
            if (items.length === 0) return null;
            return (
              <section key={group.status} aria-label={group.title}>
                <h2 className="mb-3 font-display text-xl font-bold uppercase">
                  {group.title} <span className="text-ink-3">({items.length})</span>
                </h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  {items.map((reg, index) => (
                    <Card key={reg.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <TeamLogo name={reg.entrantName} tag={reg.teamTag} mediaId={reg.teamLogo} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {group.status === "waitlisted" && <span className="mr-1 text-ink-3">#{index + 1}</span>}
                            {reg.entrantHref ? <Link href={reg.entrantHref} className="hover:text-brand">{reg.entrantName}</Link> : reg.entrantName}
                          </p>
                          <p className="text-xs text-ink-3">Enviada el {formatDateTime(reg.createdAt)}</p>
                        </div>
                        <RegistrationBadge status={reg.status} />
                      </div>
                      {reg.roster.length > 0 && t.participantType === "team" && (
                        <ul className="mt-3 space-y-1 text-sm">
                          {reg.roster.map((p) => (
                            <li key={p.userId} className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{p.displayName}</span>
                              <span className={p.riotId ? "text-xs text-ink-3" : "text-xs text-warning"}>{p.riotId ?? "sin Riot ID"}</span>
                              {p.isSubstitute && <Badge>Suplente</Badge>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {reg.note && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">«{reg.note}»</p>}
                      {reg.decisionReason && <p className="mt-2 text-xs text-ink-3">Motivo: {reg.decisionReason}</p>}
                      {editable && ["pending", "waitlisted", "approved"].includes(reg.status) && (
                        <div className="mt-4 border-t border-line pt-3">
                          <ReviewForm registrationId={reg.id} status={reg.status} />
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
