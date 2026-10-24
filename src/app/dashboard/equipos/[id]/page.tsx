import { Crown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Avatar, TeamLogo } from "@/components/ui/avatar";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { RegistrationBadge } from "@/components/ui/status-badge";
import { canManageTeam } from "@/domain/permissions";
import { cancelInvitationAction, disbandTeamAction, removeMemberAction, transferCaptaincyAction } from "@/features/teams/actions";
import { InviteForm } from "@/features/teams/components/invite-form";
import { TeamForm } from "@/features/teams/components/team-form";
import { getTeamById, getTeamMembers, teamPendingInvitations, teamRegistrations } from "@/features/teams/queries";
import { getSettings } from "@/features/settings/service";
import { label } from "@/i18n";
import { formatDate, formatShortDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Gestionar equipo" };

export default async function ManageTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/equipos/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const team = await getTeamById(id);
  if (!team) notFound();
  const members = await getTeamMembers(team.id, team.captainId);
  const isMember = members.some((m) => m.userId === user.id);
  const isCaptain = canManageTeam(user, team);
  if (!isMember && !isCaptain) notFound();

  const [invitations, registrations, settings] = await Promise.all([
    isCaptain ? teamPendingInvitations(team.id) : Promise.resolve([]),
    teamRegistrations(team.id),
    getSettings(),
  ]);
  const disbanded = team.status === "disbanded";

  return (
    <>
      <DashboardTitle
        title={
          <span className="flex items-center gap-3">
            <TeamLogo name={team.name} tag={team.tag} mediaId={team.logoMediaId} size="md" />
            {team.name}
          </span>
        }
        description={disbanded ? "Este equipo está disuelto." : `[${team.tag}] · ${members.length} de ${settings.maxTeamMembers} miembros`}
        actions={
          <ButtonLink href={`/equipos/${team.slug}`} variant="outline">
            <ExternalLink aria-hidden className="size-4" /> Página pública
          </ButtonLink>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title="Miembros" description="Cuántos juegan cada torneo (titulares y suplentes) lo eliges al inscribir al equipo." />
            <ul className="divide-y divide-line">
              {members.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={m.displayName} mediaId={m.avatarMediaId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {m.isPublic ? (
                        <Link href={`/jugadores/${m.handle}`} className="hover:text-brand">
                          {m.displayName}
                        </Link>
                      ) : (
                        m.displayName
                      )}
                      {m.isCaptain && (
                        <Badge tone="trophy">
                          <Crown aria-hidden className="size-3" /> Capitán
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-ink-3">
                      @{m.handle} · {m.riotId ?? "sin Riot ID"}
                      {m.mainPosition ? ` · ${label("position", m.mainPosition as "top")}` : ""} · desde {formatShortDate(m.joinedAt)}
                    </p>
                  </div>
                  {!disbanded && isCaptain && !m.isCaptain && (
                    <div className="flex flex-wrap gap-2">
                      <ConfirmForm
                        action={transferCaptaincyAction}
                        hidden={{ teamId: team.id, userId: m.userId }}
                        trigger="Hacer capitán"
                        triggerVariant="ghost"
                        size="sm"
                        title={`¿Ceder la capitanía a ${m.displayName}?`}
                        description="Dejarás de poder gestionar el equipo y sus inscripciones. Seguirás siendo miembro."
                        confirmLabel="Ceder capitanía"
                      />
                      <ConfirmForm
                        action={removeMemberAction}
                        hidden={{ teamId: team.id, userId: m.userId }}
                        trigger="Expulsar"
                        triggerVariant="ghost"
                        variant="danger"
                        size="sm"
                        title={`¿Retirar a ${m.displayName} del equipo?`}
                        description="No es posible si está en la plantilla inscrita de un torneo que no ha terminado."
                        confirmLabel="Retirar"
                      />
                    </div>
                  )}
                  {!disbanded && m.userId === user.id && !m.isCaptain && (
                    <ConfirmForm
                      action={removeMemberAction}
                      hidden={{ teamId: team.id, userId: user.id }}
                      trigger="Salir del equipo"
                      triggerVariant="outline"
                      variant="danger"
                      size="sm"
                      title="¿Salir del equipo?"
                      description="Para volver, el capitán tendrá que invitarte de nuevo."
                      confirmLabel="Salir"
                    />
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Inscripciones" />
            {registrations.length > 0 ? (
              <ul className="divide-y divide-line">
                {registrations.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/torneos/${r.tournamentSlug}`} className="font-semibold hover:text-brand">
                        {r.tournamentName}
                      </Link>
                      <p className="text-xs text-ink-3">Empieza el {formatDate(r.startsAt)}</p>
                    </div>
                    <RegistrationBadge status={r.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-sm text-ink-3">
                  El equipo no se ha inscrito todavía en ningún torneo.{" "}
                  {isCaptain && (
                    <Link href="/torneos?estado=open" className="font-semibold text-brand hover:underline">
                      Ver torneos abiertos
                    </Link>
                  )}
                </p>
              </CardBody>
            )}
          </Card>

          {isCaptain && !disbanded && (
            <Card>
              <CardHeader title="Datos del equipo" />
              <CardBody className="py-5">
                <TeamForm team={team} />
              </CardBody>
            </Card>
          )}
        </div>

        {isCaptain && !disbanded && (
          <div className="space-y-6">
            <Card>
              <CardHeader title="Invitar jugadores" />
              <CardBody className="py-5">
                {members.length >= settings.maxTeamMembers ? (
                  <p className="text-sm text-ink-3">El equipo está completo ({settings.maxTeamMembers} miembros).</p>
                ) : (
                  <InviteForm teamId={team.id} />
                )}
              </CardBody>
            </Card>
            {invitations.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader title="Invitaciones enviadas" />
                <ul className="divide-y divide-line">
                  {invitations.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-2 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{inv.inviteeName}</p>
                        <p className="text-xs text-ink-3">@{inv.inviteeHandle} · caduca el {formatShortDate(inv.expiresAt)}</p>
                      </div>
                      <ActionButton action={cancelInvitationAction} fields={{ invitationId: inv.id }} size="sm" variant="ghost" showSuccess={false}>
                        Cancelar
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card className="border-danger/30">
              <CardHeader title="Zona de peligro" />
              <CardBody className="space-y-3 py-5 text-sm text-ink-3">
                <p>Disolver el equipo lo retira de la plataforma. Su historial de torneos se conserva. No se puede deshacer.</p>
                <ConfirmForm
                  action={disbandTeamAction}
                  hidden={{ teamId: team.id }}
                  trigger="Disolver equipo"
                  triggerVariant="outline"
                  variant="danger"
                  title={`¿Disolver ${team.name}?`}
                  description="No es posible si el equipo está inscrito en un torneo que no ha terminado."
                  confirmLabel="Disolver"
                />
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
