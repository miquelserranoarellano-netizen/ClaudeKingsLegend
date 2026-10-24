import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";
import { requirePlatformAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { auditLogs, profiles, tournaments } from "@/server/db/schema";

export const metadata = { title: "Auditoría" };

const ENTITIES = ["user", "profile", "team", "team_member", "team_invitation", "tournament", "registration", "match", "match_result", "dispute", "announcement", "content_page", "setting"];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entidad?: string; accion?: string; pagina?: string }> }) {
  await requirePlatformAdmin("/admin/auditoria");
  const params = await searchParams;
  const entity = ENTITIES.includes(params.entidad ?? "") ? params.entidad : undefined;
  const action = params.accion?.trim().slice(0, 60) || undefined;
  const page = Math.max(1, Number(params.pagina) || 1);
  const pageSize = 40;
  const db = await getDb();
  const where = and(entity ? eq(auditLogs.entityType, entity) : undefined, action ? ilike(auditLogs.action, `%${action.replace(/[%_\\]/g, "\\$&")}%`) : undefined);
  const [rows, [count]] = await Promise.all([
    db
      .select({ log: auditLogs, actor: profiles.displayName, tournament: tournaments.name })
      .from(auditLogs)
      .leftJoin(profiles, eq(profiles.userId, auditLogs.actorId))
      .leftJoin(tournaments, eq(tournaments.id, auditLogs.tournamentId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(auditLogs).where(where),
  ]);
  const pageCount = Math.max(1, Math.ceil((count?.total ?? 0) / pageSize));

  return (
    <>
      <DashboardTitle title="Auditoría" description="Registro de solo inserción: quién cambió qué y cuándo, con los valores anteriores y nuevos. No contiene contraseñas ni tokens." />
      <form action="/admin/auditoria" className="mb-4 flex flex-wrap gap-2">
        <select name="entidad" defaultValue={entity ?? ""} aria-label="Tipo de entidad" className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm">
          <option value="">Todas las entidades</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <input name="accion" defaultValue={action} placeholder="Acción (p. ej. result)" aria-label="Acción" className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm" />
        <button className="h-9 rounded-lg bg-night px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="border-b border-line bg-surface-2/60 text-left text-xs tracking-wide text-ink-3 uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5">Fecha</th>
              <th scope="col" className="px-4 py-2.5">Quién</th>
              <th scope="col" className="px-4 py-2.5">Acción</th>
              <th scope="col" className="px-4 py-2.5">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.map(({ log, actor, tournament }) => (
              <tr key={log.id}>
                <td className="px-4 py-2.5 whitespace-nowrap text-ink-3 tabular">{formatDateTime(log.createdAt)}</td>
                <td className="px-4 py-2.5">{actor ?? <span className="text-ink-3">Sistema</span>}</td>
                <td className="px-4 py-2.5">
                  <code className="text-xs font-semibold">{log.action}</code>
                  <p className="text-xs text-ink-3">{log.entityType} · {log.entityId.slice(0, 8)}{tournament ? ` · ${tournament}` : ""}</p>
                </td>
                <td className="px-4 py-2.5">
                  {log.data ? (
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-ink-2">Ver datos</summary>
                      <pre className="mt-1 max-w-md overflow-x-auto rounded bg-surface-2 p-2 text-[11px] leading-snug">{JSON.stringify(log.data, null, 2)}</pre>
                    </details>
                  ) : (
                    <span className="text-xs text-ink-3">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefFor={(p) => `/admin/auditoria?${new URLSearchParams({ ...(entity ? { entidad: entity } : {}), ...(action ? { accion: action } : {}), pagina: String(p) })}`}
      />
    </>
  );
}
