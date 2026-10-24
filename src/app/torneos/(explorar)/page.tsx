import { Search, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/layout/section";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { canCreateTournament } from "@/domain/permissions";
import type { TournamentCategory } from "@/domain/tournament/phase";
import { TournamentCard } from "@/features/tournaments/components/tournament-card";
import { listPublicTournaments, type TournamentSort } from "@/features/tournaments/queries";
import { label } from "@/i18n";
import { cn } from "@/lib/cn";
import { fromDateTimeLocal } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Torneos y ligas",
  description: "Explora los torneos y ligas de League of Legends: inscripciones abiertas, próximos, en curso y finalizados.",
  alternates: { canonical: "/torneos" },
};

type Params = { q?: string; estado?: string; formato?: string; tipo?: string; desde?: string; hasta?: string; orden?: string; pagina?: string };

const CATEGORIES: { value: TournamentCategory | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Inscripción abierta" },
  { value: "upcoming", label: "Próximos" },
  { value: "live", label: "En curso" },
  { value: "finished", label: "Finalizados" },
  { value: "cancelled", label: "Cancelados" },
];
const FORMATS = ["single_elimination", "double_elimination", "league"] as const;
const SORTS: { value: TournamentSort; label: string }[] = [
  { value: "starts_asc", label: "Inicio: próximos" },
  { value: "starts_desc", label: "Inicio: recientes" },
  { value: "participants", label: "Participantes" },
  { value: "popular", label: "Popularidad" },
];

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const category = pick(params.estado, CATEGORIES.map((c) => c.value)) ?? "all";
  const format = pick(params.formato, FORMATS);
  const participantType = pick(params.tipo, ["team", "solo"] as const);
  const sort = pick(params.orden, SORTS.map((s) => s.value)) ?? (category === "finished" ? "starts_desc" : "starts_asc");
  const from = params.desde && /^\d{4}-\d{2}-\d{2}$/.test(params.desde) ? fromDateTimeLocal(`${params.desde}T00:00`) : null;
  const to = params.hasta && /^\d{4}-\d{2}-\d{2}$/.test(params.hasta) ? fromDateTimeLocal(`${params.hasta}T23:59`) : null;
  const q = params.q?.trim().slice(0, 80) || undefined;
  const page = Math.max(1, Number(params.pagina) || 1);

  const [user, result] = await Promise.all([
    getCurrentUser(),
    listPublicTournaments({ q, category, format, participantType, from, to, sort, page }),
  ]);

  const query = (overrides: Partial<Params>) => {
    const merged: Params = { q, estado: category === "all" ? undefined : category, formato: format, tipo: participantType, desde: params.desde, hasta: params.hasta, orden: params.orden, ...overrides };
    const search = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]);
    const s = search.toString();
    return s ? `/torneos?${s}` : "/torneos";
  };
  const filtered = Boolean(q || format || participantType || from || to || category !== "all");

  return (
    <>
      <PageHeader
        eyebrow="Competiciones"
        title="Torneos y ligas"
        description="Busca, filtra y apúntate. Cada torneo tiene su reglamento, sus fechas y sus plazas."
        actions={user && canCreateTournament(user) ? <ButtonLink href="/admin/torneos/nuevo">Crear torneo</ButtonLink> : undefined}
      >
        <nav aria-label="Estado de los torneos" className="-mb-px mt-8 flex gap-1 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={query({ estado: c.value === "all" ? undefined : c.value, pagina: undefined })}
              aria-current={category === c.value ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-t-lg border border-b-0 px-4 py-2 text-sm font-semibold",
                category === c.value ? "border-line bg-page text-ink" : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <Container className="py-8">
        <form action="/torneos" method="get" className="mb-8 grid gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[2fr_repeat(5,1fr)_auto] lg:items-end">
          {category !== "all" && <input type="hidden" name="estado" value={category} />}
          <label className="space-y-1 text-sm font-semibold">
            <span>Buscar por nombre</span>
            <span className="relative block">
              <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <input name="q" defaultValue={q} placeholder="Nombre del torneo" className="h-10 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm font-normal" />
            </span>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Formato</span>
            <select name="formato" defaultValue={format ?? ""} className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm font-normal">
              <option value="">Todos</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {label("format", f)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Tipo</span>
            <select name="tipo" defaultValue={participantType ?? ""} className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm font-normal">
              <option value="">Todos</option>
              <option value="team">{label("participantType", "team")}</option>
              <option value="solo">{label("participantType", "solo")}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Empieza desde</span>
            <input type="date" name="desde" defaultValue={params.desde} className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Hasta</span>
            <input type="date" name="hasta" defaultValue={params.hasta} className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Ordenar por</span>
            <select name="orden" defaultValue={sort} className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm font-normal">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button type="submit">Aplicar</Button>
            {filtered && (
              <ButtonLink href="/torneos" variant="ghost">
                Limpiar
              </ButtonLink>
            )}
          </div>
        </form>

        <p className="mb-4 text-sm text-ink-3" aria-live="polite">
          {result.total === 1 ? "1 torneo" : `${result.total} torneos`}
          {q ? ` para «${q}»` : ""}
        </p>

        {result.items.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((t) => (
              <TournamentCard key={t.id} tournament={t} headingLevel="h2" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Trophy}
            title={filtered ? "Ningún torneo coincide" : "Aún no hay torneos"}
            action={
              filtered ? (
                <ButtonLink href="/torneos" variant="outline">
                  Quitar filtros
                </ButtonLink>
              ) : user && canCreateTournament(user) ? (
                <ButtonLink href="/admin/torneos/nuevo">Crear el primer torneo</ButtonLink>
              ) : undefined
            }
          >
            {filtered ? "Prueba con otros filtros o con otro nombre." : "Cuando la organización publique torneos, aparecerán aquí."}
          </EmptyState>
        )}

        <div className="mt-8">
          <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(p) => query({ pagina: p > 1 ? String(p) : undefined })} />
        </div>
      </Container>
    </>
  );
}
