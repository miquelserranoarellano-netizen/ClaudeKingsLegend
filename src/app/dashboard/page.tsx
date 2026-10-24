import { AlertCircle, Bell, CalendarClock, Mail, Plus, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { TeamLogo } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RegistrationBadge } from "@/components/ui/status-badge";
import { MatchList } from "@/features/competition/components/match-list";
import { myMatches } from "@/features/competition/queries";
import { listNotifications } from "@/features/notifications/service";
import { myRegistrations } from "@/features/registrations/queries";
import { InvitationList } from "@/features/teams/components/invitation-list";
import { myInvitations, myTeams } from "@/features/teams/queries";
import { formatRelative, formatShortDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { isMailConfigured } from "@/server/mail";

export default async function DashboardHome() {
  const user = await requireUser("/dashboard");
  const [matches, invitations, teams, registrations, notifications] = await Promise.all([
    myMatches(user.id, "upcoming", 5),
    myInvitations(user.id),
    myTeams(user.id),
    myRegistrations(user.id),
    listNotifications(user.id, 1, 5),
  ]);

  return (
    <>
      <DashboardTitle title={`Hola, ${user.displayName}`} description="Lo que tienes pendiente en Kings Legend." />

      <div className="mb-6 space-y-3">
        {!user.hasRiotId && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
            <AlertCircle aria-hidden className="size-4" />
            La mayoría de torneos exigen un Riot ID para inscribirse.
            <Link href="/dashboard/perfil" className="font-semibold underline underline-offset-2">
              Añádelo a tu perfil
            </Link>
          </p>
        )}
        {!user.emailVerified && isMailConfigured() && (
          <p className="flex items-center gap-2 rounded-lg border border-upcoming/30 bg-upcoming-soft px-4 py-3 text-sm text-upcoming">
            <Mail aria-hidden className="size-4" /> Todavía no has confirmado tu correo.
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader title="Próximos partidos" action={<Link href="/dashboard/partidos" className="text-sm font-semibold text-ink-2 hover:text-brand">Ver todos</Link>} />
          {matches.length > 0 ? (
            <MatchList items={matches} mode="upcoming" />
          ) : (
            <div className="p-4">
              <EmptyState icon={CalendarClock} title="Sin partidos pendientes" compact>
                Cuando un torneo en el que participas genere su cuadro, tus partidos aparecerán aquí.
              </EmptyState>
            </div>
          )}
        </Card>

        {invitations.length > 0 && (
          <Card className="overflow-hidden xl:col-span-2">
            <CardHeader title={`Invitaciones (${invitations.length})`} />
            <InvitationList items={invitations} />
          </Card>
        )}

        <Card className="overflow-hidden">
          <CardHeader
            title="Mis equipos"
            action={
              <ButtonLink href="/dashboard/equipos/nuevo" size="sm" variant="outline">
                <Plus aria-hidden className="size-4" /> Crear
              </ButtonLink>
            }
          />
          {teams.length > 0 ? (
            <ul className="divide-y divide-line">
              {teams.map((team) => (
                <li key={team.id}>
                  <Link href={`/dashboard/equipos/${team.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                    <TeamLogo name={team.name} tag={team.tag} mediaId={team.logoMediaId} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{team.name}</span>
                    <span className="text-xs text-ink-3">
                      {team.captainId === user.id ? "Capitán · " : ""}
                      {team.members} miembros
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <EmptyState icon={Users} title="Sin equipo" compact action={<ButtonLink href="/dashboard/equipos/nuevo" size="sm">Crear equipo</ButtonLink>}>
                Crea el tuyo o pide a un capitán que te invite con tu identificador @{user.handle}.
              </EmptyState>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Mis inscripciones" action={<Link href="/dashboard/torneos" className="text-sm font-semibold text-ink-2 hover:text-brand">Ver todas</Link>} />
          {registrations.length > 0 ? (
            <ul className="divide-y divide-line">
              {registrations.slice(0, 5).map((reg) => (
                <li key={reg.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/torneos/${reg.tournamentSlug}`} className="block truncate font-semibold hover:text-brand">
                      {reg.tournamentName}
                    </Link>
                    <p className="text-xs text-ink-3">
                      {reg.teamName ?? "Individual"} · empieza el {formatShortDate(reg.startsAt)}
                    </p>
                  </div>
                  <RegistrationBadge status={reg.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <EmptyState icon={Ticket} title="Sin inscripciones" compact action={<ButtonLink href="/torneos?estado=open" size="sm">Buscar torneos</ButtonLink>}>
                Busca un torneo con la inscripción abierta.
              </EmptyState>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader title="Últimos avisos" action={<Link href="/dashboard/notificaciones" className="text-sm font-semibold text-ink-2 hover:text-brand">Ver todos</Link>} />
          {notifications.items.length > 0 ? (
            <ul className="divide-y divide-line">
              {notifications.items.map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={n.readAt ? "mt-1.5 size-2 rounded-full bg-transparent" : "mt-1.5 size-2 rounded-full bg-brand"} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.link ? <Link href={n.link} className="hover:text-brand">{n.title}</Link> : n.title}</p>
                    {n.body && <p className="text-sm text-ink-3">{n.body}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-ink-3">{formatRelative(n.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-ink-3">
              <Bell aria-hidden className="size-4" /> No tienes avisos.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
