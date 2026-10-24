import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/layout/section";
import { TeamLogo } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { DemoBadge } from "@/components/ui/status-badge";
import { listTeams } from "@/features/teams/queries";

export const metadata: Metadata = { title: "Equipos", description: "Equipos de League of Legends que compiten en Kings Legend.", alternates: { canonical: "/equipos" } };

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) || undefined;
  const result = await listTeams({ q, page: Math.max(1, Number(params.pagina) || 1) });
  return (
    <>
      <PageHeader eyebrow="Comunidad" title="Equipos" description="Todos los equipos activos. Crea el tuyo desde tu panel." actions={<ButtonLink href="/dashboard/equipos/nuevo">Crear equipo</ButtonLink>} />
      <Container className="py-8">
        <form action="/equipos" className="mb-6 flex max-w-lg gap-2">
          <span className="relative flex-1">
            <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <input name="q" defaultValue={q} placeholder="Nombre o etiqueta" aria-label="Buscar equipos" className="h-10 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm" />
          </span>
          <button className="h-10 rounded-lg bg-night px-4 text-sm font-semibold text-white">Buscar</button>
        </form>
        {result.items.length === 0 ? (
          <EmptyState icon={Users} title={q ? "Ningún equipo coincide" : "Todavía no hay equipos"} action={<ButtonLink href="/dashboard/equipos/nuevo">Crear el primero</ButtonLink>}>
            {q ? "Prueba con otro nombre o etiqueta." : "Crea un equipo, invita a tu gente y apúntate a un torneo."}
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((team) => (
              <li key={team.id} className="relative flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card hover:shadow-lift">
                <TeamLogo name={team.name} tag={team.tag} mediaId={team.logoMediaId} size="lg" />
                <div className="min-w-0">
                  <h2 className="font-display text-xl leading-tight font-bold uppercase">
                    <Link href={`/equipos/${team.slug}`} className="after:absolute after:inset-0 hover:text-brand">{team.name}</Link>
                  </h2>
                  <p className="text-sm text-ink-3">[{team.tag}] · {team.members} miembros</p>
                  {team.isDemo && <DemoBadge />}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8">
          <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(p) => `/equipos?${new URLSearchParams({ ...(q ? { q } : {}), pagina: String(p) })}`} />
        </div>
      </Container>
    </>
  );
}
