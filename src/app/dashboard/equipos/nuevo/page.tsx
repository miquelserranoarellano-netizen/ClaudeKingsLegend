import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Card, CardBody } from "@/components/ui/card";
import { TeamForm } from "@/features/teams/components/team-form";
import { getSettings } from "@/features/settings/service";
import { isAdmin } from "@/domain/permissions";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Crear equipo" };

export default async function NewTeamPage() {
  const user = await requireUser("/dashboard/equipos/nuevo");
  const settings = await getSettings();
  return (
    <>
      <DashboardTitle
        title="Crear equipo"
        description={`Serás el capitán. Un equipo puede tener hasta ${settings.maxTeamMembers} miembros; cuántos juegan cada torneo lo fija su reglamento.`}
      />
      <Card>
        <CardBody className="py-6">
          {settings.allowTeamCreation || isAdmin(user) ? (
            <TeamForm />
          ) : (
            <p className="text-sm text-ink-3">La creación de equipos está desactivada temporalmente por la administración.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
