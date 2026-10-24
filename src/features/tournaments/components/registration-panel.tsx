import { Lock, LogIn, Settings2, UserPlus } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/ui/action-button";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { RegistrationBadge } from "@/components/ui/status-badge";
import type { CurrentUser } from "@/server/auth/session";
import { canWithdraw } from "@/domain/tournament/registration";
import { withdrawRegistrationAction } from "@/features/registrations/actions";
import { SoloRegistrationForm, TeamRegistrationForm } from "@/features/registrations/components/team-registration-form";
import { viewerRegistration } from "@/features/registrations/queries";
import { captainTeamsWithMembers } from "@/features/teams/queries";
import { label } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import type { TournamentDetail } from "../queries";

/** Panel lateral de inscripción: lo que ve cada persona depende de su rol y del momento del torneo. */
export async function RegistrationPanel({ detail, viewer, accessCode }: { detail: TournamentDetail; viewer: CurrentUser | null; accessCode: string | null }) {
  const { tournament: t, rules, phase } = detail;
  const full = detail.counts.approved >= t.maxParticipants;
  const registration = viewer ? await viewerRegistration(t.id, viewer.id) : null;
  const next = `/torneos/${t.slug}${accessCode ? `?codigo=${accessCode}` : ""}`;

  let body: React.ReactNode;
  if (detail.viewer.canManage) {
    body = (
      <div className="space-y-3 text-sm">
        <p className="text-ink-2">Gestionas este torneo.</p>
        <ButtonLink href={`/admin/torneos/${t.id}`} className="w-full">
          <Settings2 aria-hidden className="size-4" /> Gestionar torneo
        </ButtonLink>
      </div>
    );
  } else if (registration && ["pending", "approved", "waitlisted"].includes(registration.status)) {
    const canManageIt = registration.captainId === viewer?.id || registration.userId === viewer?.id;
    body = (
      <div className="space-y-3 text-sm">
        <p className="flex items-center justify-between gap-2">
          <span className="font-semibold">{registration.teamName ?? "Tu inscripción"}</span>
          <RegistrationBadge status={registration.status} />
        </p>
        {registration.status === "pending" && <p className="text-ink-3">La organización revisará la inscripción y te avisaremos.</p>}
        {registration.status === "waitlisted" && <p className="text-ink-3">Si se libera una plaza, entraréis por orden de llegada.</p>}
        {registration.status === "approved" && <p className="text-ink-3">Estáis dentro. Los partidos aparecerán cuando se genere el cuadro.</p>}
        {canManageIt && canWithdraw(phase) && (
          <ActionButton action={withdrawRegistrationAction} fields={{ registrationId: registration.id }} variant="outline" size="sm">
            Retirar inscripción
          </ActionButton>
        )}
      </div>
    );
  } else if (phase === "registration_upcoming") {
    body = <p className="text-sm text-ink-2">Las inscripciones abren el {formatDateTime(t.registrationOpensAt)}.</p>;
  } else if (phase !== "registration_open") {
    body = <p className="text-sm text-ink-2">{phase === "registration_closed" ? "Las inscripciones están cerradas." : label("tournamentPhase", phase)}.</p>;
  } else if (!viewer) {
    body = (
      <div className="space-y-3 text-sm">
        <p className="text-ink-2">Inicia sesión para inscribirte{t.participantType === "team" ? " con tu equipo" : ""}.</p>
        <ButtonLink href={`/acceso?next=${encodeURIComponent(next)}`} className="w-full">
          <LogIn aria-hidden className="size-4" /> Iniciar sesión
        </ButtonLink>
        <ButtonLink href={`/registro?next=${encodeURIComponent(next)}`} variant="outline" className="w-full">
          Crear cuenta
        </ButtonLink>
      </div>
    );
  } else if (full && !rules.waitlistEnabled) {
    body = <p className="text-sm text-ink-2">No quedan plazas y este torneo no tiene lista de espera.</p>;
  } else if (t.participantType === "solo") {
    body = (
      <div className="space-y-3">
        {rules.requireRiotId && !viewer.hasRiotId ? (
          <p className="text-sm text-warning">
            Necesitas un Riot ID en tu perfil para inscribirte. <Link href="/dashboard/perfil" className="font-semibold underline">Añadirlo</Link>
          </p>
        ) : (
          <SoloRegistrationForm tournamentId={t.id} accessCode={accessCode} />
        )}
      </div>
    );
  } else {
    const teams = await captainTeamsWithMembers(viewer.id);
    body =
      teams.length === 0 ? (
        <div className="space-y-3 text-sm">
          <p className="text-ink-2">Solo el capitán de un equipo puede inscribirlo. Crea tu equipo o pide a tu capitán que lo inscriba.</p>
          <ButtonLink href="/dashboard/equipos/nuevo" variant="outline" className="w-full">
            <UserPlus aria-hidden className="size-4" /> Crear equipo
          </ButtonLink>
        </div>
      ) : (
        <TeamRegistrationForm
          tournamentId={t.id}
          accessCode={accessCode}
          teams={teams}
          teamSize={rules.teamSize}
          maxSubstitutes={rules.maxSubstitutes}
          requireRiotId={rules.requireRiotId}
        />
      );
  }

  return (
    <Card>
      <CardHeader
        title="Inscripción"
        as="h2"
        description={
          full && phase === "registration_open"
            ? rules.waitlistEnabled
              ? "Plazas completas: las nuevas inscripciones van a la lista de espera."
              : "Plazas completas."
            : `${detail.counts.approved} de ${t.maxParticipants} plazas ocupadas`
        }
      />
      <CardBody className="py-5">
        {t.visibility === "private" && (
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-ink-3">
            <Lock aria-hidden className="size-3.5" /> Torneo privado: solo con invitación.
          </p>
        )}
        {body}
        {registration?.status === "rejected" && registration.decisionReason && (
          <p className="mt-3 text-xs text-ink-3">Inscripción anterior rechazada: {registration.decisionReason}</p>
        )}
      </CardBody>
    </Card>
  );
}
