import { notFound } from "next/navigation";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { canCreateTournament } from "@/domain/permissions";
import { TournamentForm } from "@/features/tournaments/components/tournament-form";
import { requireAdminArea } from "@/server/auth/session";

export const metadata = { title: "Nuevo torneo" };

export default async function NewTournamentPage() {
  const user = await requireAdminArea("/admin/torneos/nuevo");
  if (!canCreateTournament(user)) notFound();
  return (
    <>
      <DashboardTitle title="Nuevo torneo" description="Se guarda como borrador. Podrás revisarlo y publicarlo después." />
      <TournamentForm />
    </>
  );
}
