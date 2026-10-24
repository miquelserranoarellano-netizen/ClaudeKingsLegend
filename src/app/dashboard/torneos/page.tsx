import { Ticket } from "lucide-react";
import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { ActionButton } from "@/components/ui/action-button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RegistrationBadge } from "@/components/ui/status-badge";
import { tournamentPhase } from "@/domain/tournament/phase";
import { canWithdraw } from "@/domain/tournament/registration";
import { withdrawRegistrationAction } from "@/features/registrations/actions";
import { myRegistrations } from "@/features/registrations/queries";
import { label } from "@/i18n";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Mis torneos" };

export default async function MyTournamentsPage() {
  const user = await requireUser("/dashboard/torneos");
  const registrations = await myRegistrations(user.id);
  const now = new Date();
  return (
    <>
      <DashboardTitle
        title="Mis torneos"
        description="Tus inscripciones y las de los equipos en los que juegas."
        actions={<ButtonLink href="/torneos?estado=open">Buscar torneos</ButtonLink>}
      />
      {registrations.length === 0 ? (
        <EmptyState icon={Ticket} title="Sin inscripciones" action={<ButtonLink href="/torneos?estado=open">Ver torneos abiertos</ButtonLink>}>
          Cuando te inscribas (o te inscriba tu capitán), el torneo aparecerá aquí con su estado.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {registrations.map((reg) => {
              const phase = tournamentPhase({ status: reg.tournamentStatus, registrationOpensAt: reg.registrationOpensAt, registrationClosesAt: reg.registrationClosesAt }, now);
              const canManage = reg.captainId === user.id || reg.soloUserId === user.id;
              const active = ["pending", "approved", "waitlisted"].includes(reg.status);
              return (
                <li key={reg.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/torneos/${reg.tournamentSlug}`} className="font-semibold hover:text-brand">
                      {reg.tournamentName}
                    </Link>
                    <p className="text-xs text-ink-3">
                      {label("format", reg.format)} · {reg.teamName ?? "Individual"} · {label("tournamentPhase", phase)} · empieza el {formatDate(reg.startsAt)}
                    </p>
                    {reg.decisionReason && <p className="mt-1 text-sm text-ink-2">Motivo: {reg.decisionReason}</p>}
                  </div>
                  <RegistrationBadge status={reg.status} />
                  {canManage && active && canWithdraw(phase) && (
                    <ActionButton action={withdrawRegistrationAction} fields={{ registrationId: reg.id }} size="sm" variant="ghost">
                      Retirar inscripción
                    </ActionButton>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
