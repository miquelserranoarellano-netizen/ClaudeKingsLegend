import { desc, eq } from "drizzle-orm";
import { CalendarCog, ExternalLink, ListChecks, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { ActionButton } from "@/components/ui/action-button";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Input } from "@/components/ui/form";
import { DemoBadge, PhaseBadge } from "@/components/ui/status-badge";
import { startBlockers } from "@/domain/tournament/registration";
import {
  cancelTournamentAction,
  closeRegistrationsAction,
  deleteDraftAction,
  publishTournamentAction,
  regenerateAccessCodeAction,
  revertToDraftAction,
  startTournamentAction,
} from "@/features/tournaments/actions";
import { SeedsForm } from "@/features/tournaments/components/seeds-form";
import { getManagedTournament, getParticipants } from "@/features/tournaments/queries";
import { label, t as tr, type MessageKey } from "@/i18n";
import { formatDateTime, formatRelative } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { requireAdminArea } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { auditLogs, profiles, tournamentRegistrations } from "@/server/db/schema";

export const metadata = { title: "Gestionar torneo" };

export default async function ManageTournamentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string; guardado?: string }> }) {
  const [{ id }, flags] = await Promise.all([params, searchParams]);
  const user = await requireAdminArea(`/admin/torneos/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const managed = await getManagedTournament(id, user);
  if (!managed) notFound();
  const { tournament: t, phase } = managed;
  const db = await getDb();
  const [participants, registrations, history] = await Promise.all([
    getParticipants(t.id),
    db.select({ status: tournamentRegistrations.status }).from(tournamentRegistrations).where(eq(tournamentRegistrations.tournamentId, t.id)),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, actor: profiles.displayName, data: auditLogs.data })
      .from(auditLogs)
      .leftJoin(profiles, eq(profiles.userId, auditLogs.actorId))
      .where(eq(auditLogs.tournamentId, t.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(12),
  ]);
  const count = (s: string) => registrations.filter((r) => r.status === s).length;
  const blockers = startBlockers({ phase, approvedCount: participants.length, minParticipants: t.minParticipants, maxParticipants: t.maxParticipants });
  const hidden = { tournamentId: t.id };
  const inviteLink = t.accessCode ? `${siteUrl()}/torneos/${t.slug}?codigo=${t.accessCode}` : null;

  return (
    <>
      <DashboardTitle
        title={t.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={phase} /> {label("format", t.format)} · {label("participantType", t.participantType)} {t.isDemo && <DemoBadge />}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/torneos/${t.slug}${t.accessCode ? `?codigo=${t.accessCode}` : ""}`} variant="outline">
              <ExternalLink aria-hidden className="size-4" /> Ver página
            </ButtonLink>
            {t.status !== "completed" && t.status !== "cancelled" && (
              <ButtonLink href={`/admin/torneos/${t.id}/editar`} variant="outline">
                <Pencil aria-hidden className="size-4" /> Editar
              </ButtonLink>
            )}
          </>
        }
      />
      {(flags.creado || flags.guardado) && (
        <p role="status" className="mb-4 rounded-lg bg-open-soft px-4 py-2.5 text-sm text-open">
          {flags.creado ? "Borrador creado. Revísalo y publícalo cuando esté listo." : "Cambios guardados."}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Siguiente paso" />
            <CardBody className="space-y-4">
              {t.status === "draft" && (
                <>
                  <p className="text-sm text-ink-2">El torneo es un borrador: solo lo ves tú. Al publicarlo aparecerá en el explorador y las inscripciones se abrirán el {formatDateTime(t.registrationOpensAt)}.</p>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton action={publishTournamentAction} fields={hidden}>Publicar torneo</ActionButton>
                    <ConfirmForm action={deleteDraftAction} hidden={hidden} trigger="Eliminar borrador" triggerVariant="ghost" variant="danger" title="¿Eliminar este borrador?" description="Se borra por completo. No se puede deshacer." confirmLabel="Eliminar" />
                  </div>
                </>
              )}
              {phase === "registration_upcoming" && (
                <p className="text-sm text-ink-2">Publicado. Las inscripciones abren el {formatDateTime(t.registrationOpensAt)}.</p>
              )}
              {phase === "registration_open" && (
                <>
                  <p className="text-sm text-ink-2">Inscripciones abiertas hasta el {formatDateTime(t.registrationClosesAt)}. {participants.length} aprobados de {t.maxParticipants}.</p>
                  <ConfirmForm action={closeRegistrationsAction} hidden={hidden} trigger="Cerrar inscripciones ahora" triggerVariant="outline" title="¿Cerrar las inscripciones?" description="Nadie más podrá inscribirse. Podrás reabrirlas editando la fecha de cierre." confirmLabel="Cerrar inscripciones" />
                </>
              )}
              {phase === "registration_closed" && (
                <>
                  <p className="text-sm text-ink-2">
                    Inscripciones cerradas. Al iniciar la competición se generan el {t.format === "league" ? "calendario de jornadas" : "cuadro"} con los {participants.length} participantes aprobados, se cierran las solicitudes pendientes y se avisa a todos.
                  </p>
                  {blockers.length > 0 ? (
                    <ul className="list-inside list-disc text-sm text-danger">
                      {blockers.map((b) => (
                        <li key={b}>{tr(`startBlockers.${b}` as MessageKey, { min: t.minParticipants, max: t.maxParticipants, count: participants.length })}</li>
                      ))}
                    </ul>
                  ) : (
                    <ConfirmForm
                      action={startTournamentAction}
                      hidden={hidden}
                      trigger="Iniciar competición"
                      title="¿Generar el cuadro e iniciar?"
                      description="Después ya no se podrán cambiar el formato, las plazas ni las semillas."
                      confirmLabel="Iniciar"
                    />
                  )}
                </>
              )}
              {t.status === "in_progress" && (
                <p className="text-sm text-ink-2">Competición en curso. Programa los partidos y valida los resultados desde «Partidos».</p>
              )}
              {t.status === "completed" && <p className="text-sm text-ink-2">Torneo terminado el {formatDateTime(t.completedAt)}.</p>}
              {t.status === "cancelled" && <p className="text-sm text-danger">Cancelado: {t.cancelReason}</p>}

              {t.status === "published" && registrations.length === 0 && (
                <ActionButton action={revertToDraftAction} fields={hidden} variant="ghost" size="sm">
                  Volver a borrador
                </ActionButton>
              )}
            </CardBody>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link href={`/admin/torneos/${t.id}/inscripciones`} className="rounded-card border border-line bg-surface p-4 shadow-card hover:shadow-lift">
              <ListChecks aria-hidden className="size-6 text-brand" />
              <p className="mt-2 font-display text-lg font-bold uppercase">Inscripciones</p>
              <p className="text-sm text-ink-3">
                {count("approved")} aprobadas · {count("pending")} pendientes · {count("waitlisted")} en espera
              </p>
            </Link>
            <Link href={`/admin/torneos/${t.id}/partidos`} className="rounded-card border border-line bg-surface p-4 shadow-card hover:shadow-lift">
              <CalendarCog aria-hidden className="size-6 text-brand" />
              <p className="mt-2 font-display text-lg font-bold uppercase">Partidos</p>
              <p className="text-sm text-ink-3">{t.status === "in_progress" || t.status === "completed" ? "Horarios, resultados y correcciones" : "Disponible al iniciar la competición"}</p>
            </Link>
          </div>

          {t.status === "published" && participants.length > 1 && (
            <Card>
              <CardHeader title="Semillas" description="Orden de cabezas de serie para el cuadro. Por defecto, el orden de aprobación." />
              <CardBody>
                <SeedsForm tournamentId={t.id} participants={participants.map((p) => ({ id: p.id, name: p.name, seed: p.seed }))} />
              </CardBody>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader title="Historial del torneo" description="Registro de auditoría de este torneo." />
            {history.length > 0 ? (
              <ul className="divide-y divide-line text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                    <span>
                      <strong>{h.actor ?? "Sistema"}</strong> · <code className="text-xs">{h.action}</code>
                    </span>
                    <span className="text-xs text-ink-3" title={formatDateTime(h.createdAt)}>{formatRelative(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody><p className="text-sm text-ink-3">Sin actividad.</p></CardBody>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          {inviteLink && (
            <Card>
              <CardHeader title="Enlace de invitación" description="Torneo privado: solo entra quien tenga este enlace." />
              <CardBody className="space-y-3">
                <Input readOnly value={inviteLink} aria-label="Enlace de invitación" className="text-xs" />
                <ActionButton action={regenerateAccessCodeAction} fields={hidden} variant="ghost" size="sm">
                  Renovar enlace
                </ActionButton>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Fechas" />
            <CardBody>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Abren</dt><dd>{formatDateTime(t.registrationOpensAt)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Cierran</dt><dd>{formatDateTime(t.registrationClosesAt)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Empieza</dt><dd>{formatDateTime(t.startsAt)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Plazas</dt><dd>{t.minParticipants}–{t.maxParticipants}</dd></div>
              </dl>
            </CardBody>
          </Card>
          {(t.status === "published" || t.status === "in_progress") && (
            <Card className="border-danger/30">
              <CardHeader title="Cancelar torneo" />
              <CardBody className="space-y-3 text-sm text-ink-3">
                <p>Se avisa a todos los inscritos. El torneo queda visible como cancelado.</p>
                <ConfirmForm action={cancelTournamentAction} hidden={hidden} trigger="Cancelar torneo" triggerVariant="outline" variant="danger" title="¿Cancelar el torneo?" confirmLabel="Cancelar torneo">
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold">Motivo (lo verán los participantes)</span>
                    <Input name="reason" required minLength={5} maxLength={300} />
                  </label>
                </ConfirmForm>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
