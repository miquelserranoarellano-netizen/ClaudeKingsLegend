import { Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { DemoBadge, PhaseBadge } from "@/components/ui/status-badge";
import type { TournamentCategory } from "@/domain/tournament/phase";
import { listManagedTournaments } from "@/features/tournaments/queries";
import { label } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import { requireAdminArea } from "@/server/auth/session";

export const metadata = { title: "Torneos" };

const FILTERS: { value: TournamentCategory | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borradores" },
  { value: "open", label: "Inscripción abierta" },
  { value: "upcoming", label: "Próximos" },
  { value: "live", label: "En curso" },
  { value: "finished", label: "Finalizados" },
  { value: "cancelled", label: "Cancelados" },
];

export default async function AdminTournamentsPage({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string; pagina?: string }> }) {
  const user = await requireAdminArea("/admin/torneos");
  const params = await searchParams;
  const category = (FILTERS.find((f) => f.value === params.estado)?.value ?? "all") as TournamentCategory | "all";
  const page = Math.max(1, Number(params.pagina) || 1);
  const q = params.q?.trim().slice(0, 80) || undefined;
  const result = await listManagedTournaments(user, { category, q, page });

  return (
    <>
      <DashboardTitle
        title="Torneos"
        description={user.role === "admin" ? "Todos los torneos de la plataforma." : "Los torneos que organizas."}
        actions={
          <ButtonLink href="/admin/torneos/nuevo">
            <Plus aria-hidden className="size-4" /> Nuevo torneo
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/admin/torneos" : `/admin/torneos?estado=${f.value}`}
            aria-current={category === f.value ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm font-semibold", category === f.value ? "border-night bg-night text-white" : "border-line bg-surface text-ink-2 hover:border-ink-3")}
          >
            {f.label}
          </Link>
        ))}
        <form className="ml-auto" action="/admin/torneos">
          {category !== "all" && <input type="hidden" name="estado" value={category} />}
          <input name="q" defaultValue={q} placeholder="Buscar…" aria-label="Buscar torneos" className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm" />
        </form>
      </div>
      {result.items.length === 0 ? (
        <EmptyState icon={Trophy} title="Sin torneos" action={<ButtonLink href="/admin/torneos/nuevo">Crear torneo</ButtonLink>}>
          {category === "all" && !q ? "Crea tu primer torneo: empieza como borrador y lo publicas cuando esté listo." : "Ningún torneo coincide con el filtro."}
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-line bg-surface-2/60 text-left text-xs tracking-wide text-ink-3 uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5">Torneo</th>
                <th scope="col" className="px-4 py-2.5">Estado</th>
                <th scope="col" className="px-4 py-2.5">Inicio</th>
                <th scope="col" className="px-4 py-2.5 text-right">Plazas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.items.map((t) => (
                <tr key={t.id} className="hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/torneos/${t.id}`} className="font-semibold hover:text-brand">
                      {t.name}
                    </Link>
                    <p className="flex items-center gap-2 text-xs text-ink-3">
                      {label("format", t.format)} · {t.organizerName} {t.isDemo && <DemoBadge />}
                    </p>
                  </td>
                  <td className="px-4 py-3"><PhaseBadge phase={t.phase} /></td>
                  <td className="px-4 py-3 tabular">{formatShortDate(t.startsAt)}</td>
                  <td className="px-4 py-3 text-right tabular">{t.approvedCount}/{t.maxParticipants}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        hrefFor={(p) => `/admin/torneos?${new URLSearchParams({ ...(category !== "all" ? { estado: category } : {}), ...(q ? { q } : {}), pagina: String(p) })}`}
      />
    </>
  );
}
