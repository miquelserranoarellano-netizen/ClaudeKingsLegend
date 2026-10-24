import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { TeamLogo } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Pagination } from "@/components/ui/pagination";
import { DemoBadge } from "@/components/ui/status-badge";
import { adminDisbandTeamAction } from "@/features/admin/actions";
import { listTeams } from "@/features/teams/queries";
import { requirePlatformAdmin } from "@/server/auth/session";

export const metadata = { title: "Equipos" };

export default async function AdminTeamsPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  await requirePlatformAdmin("/admin/equipos");
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) || undefined;
  const result = await listTeams({ q, page: Math.max(1, Number(params.pagina) || 1) });
  return (
    <>
      <DashboardTitle title="Equipos" description={`${result.total} equipos activos. Disolver un equipo lo retira de la plataforma y conserva su historial.`} />
      <form action="/admin/equipos" className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Nombre o etiqueta" aria-label="Buscar equipos" className="h-9 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm" />
        <button className="h-9 rounded-lg bg-night px-4 text-sm font-semibold text-white">Buscar</button>
      </form>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {result.items.map((team) => (
            <li key={team.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <TeamLogo name={team.name} tag={team.tag} mediaId={team.logoMediaId} size="sm" />
              <div className="min-w-0 flex-1">
                <Link href={`/equipos/${team.slug}`} className="font-semibold hover:text-brand">
                  {team.name}
                </Link>{" "}
                {team.isDemo && <DemoBadge />}
                <p className="text-xs text-ink-3">[{team.tag}] · {team.members} miembros</p>
              </div>
              <ConfirmForm
                action={adminDisbandTeamAction}
                hidden={{ teamId: team.id }}
                trigger="Disolver"
                triggerVariant="ghost"
                variant="danger"
                size="sm"
                title={`¿Disolver ${team.name}?`}
                description="No es posible si está inscrito en un torneo que no ha terminado."
                confirmLabel="Disolver"
              />
            </li>
          ))}
        </ul>
      </Card>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(p) => `/admin/equipos?${new URLSearchParams({ ...(q ? { q } : {}), pagina: String(p) })}`} />
    </>
  );
}
