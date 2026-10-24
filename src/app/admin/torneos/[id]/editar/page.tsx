import { notFound } from "next/navigation";
import { z } from "zod";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { TournamentForm } from "@/features/tournaments/components/tournament-form";
import { getManagedTournament } from "@/features/tournaments/queries";
import { requireAdminArea } from "@/server/auth/session";

export const metadata = { title: "Editar torneo" };

export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminArea(`/admin/torneos/${id}/editar`);
  if (!z.uuid().safeParse(id).success) notFound();
  const managed = await getManagedTournament(id, user);
  if (!managed || managed.tournament.status === "completed" || managed.tournament.status === "cancelled") notFound();
  const { tournament: t, rules } = managed;
  return (
    <>
      <DashboardTitle title="Editar torneo" description={t.name} />
      <TournamentForm
        tournament={{
          id: t.id,
          version: t.version,
          status: t.status,
          name: t.name,
          summary: t.summary,
          description: t.description,
          rulesText: t.rulesText,
          prizeDescription: t.prizeDescription,
          format: t.format,
          participantType: t.participantType,
          visibility: t.visibility,
          region: t.region,
          registrationOpensAt: t.registrationOpensAt,
          registrationClosesAt: t.registrationClosesAt,
          startsAt: t.startsAt,
          endsAt: t.endsAt,
          minParticipants: t.minParticipants,
          maxParticipants: t.maxParticipants,
          bannerMediaId: t.bannerMediaId,
          teamSize: rules.teamSize,
          maxSubstitutes: rules.maxSubstitutes,
          bestOf: rules.bestOf,
          bestOfFinal: rules.bestOfFinal,
          pointsWin: rules.pointsWin,
          pointsLoss: rules.pointsLoss,
          pointsForfeitLoss: rules.pointsForfeitLoss,
          tiebreakers: rules.tiebreakers,
          leagueLegs: rules.leagueLegs,
          grandFinalReset: rules.grandFinalReset,
          approvalMode: rules.approvalMode,
          waitlistEnabled: rules.waitlistEnabled,
          requireRiotId: rules.requireRiotId,
        }}
      />
    </>
  );
}
