import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { TeamLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { myTeams } from "@/features/teams/queries";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Mis equipos" };

export default async function MyTeamsPage() {
  const user = await requireUser("/dashboard/equipos");
  const teams = await myTeams(user.id);
  return (
    <>
      <DashboardTitle
        title="Mis equipos"
        description={`Para que te inviten, comparte tu identificador: @${user.handle}`}
        actions={
          <ButtonLink href="/dashboard/equipos/nuevo">
            <Plus aria-hidden className="size-4" /> Crear equipo
          </ButtonLink>
        }
      />
      {teams.length === 0 ? (
        <EmptyState icon={Users} title="Todavía no tienes equipo" action={<ButtonLink href="/dashboard/equipos/nuevo">Crear mi equipo</ButtonLink>}>
          Crea un equipo y serás su capitán: podrás invitar jugadores e inscribirlo en torneos.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <li key={team.id}>
              <Link href={`/dashboard/equipos/${team.id}`} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card hover:shadow-lift">
                <TeamLogo name={team.name} tag={team.tag} mediaId={team.logoMediaId} size="lg" />
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold uppercase">{team.name}</p>
                  <p className="text-sm text-ink-3">
                    [{team.tag}] · {team.members} miembros
                  </p>
                  {team.captainId === user.id && <Badge tone="brand" className="mt-2">Capitán</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
