import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { DemoBadge } from "@/components/ui/status-badge";
import type { GlobalRole } from "@/domain/permissions";
import { UserRoleForm, UserSuspensionForm } from "@/features/admin/components/user-row-actions";
import { listUsers } from "@/features/admin/users";
import { label } from "@/i18n";
import { formatDate } from "@/lib/format";
import { requirePlatformAdmin } from "@/server/auth/session";

export const metadata = { title: "Usuarios" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; rol?: string; pagina?: string }> }) {
  const user = await requirePlatformAdmin("/admin/usuarios");
  const params = await searchParams;
  const role = (["user", "organizer", "admin"] as const).find((r) => r === params.rol) as GlobalRole | undefined;
  const q = params.q?.trim().slice(0, 80) || undefined;
  const result = await listUsers(user, { q, role, page: Math.max(1, Number(params.pagina) || 1) });

  return (
    <>
      <DashboardTitle title="Usuarios" description={`${result.total} cuentas. Cambia roles o suspende cuentas: los cambios tienen efecto inmediato y quedan auditados.`} />
      <form action="/admin/usuarios" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Correo, nombre o identificador" aria-label="Buscar usuarios" className="h-9 min-w-60 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm" />
        <select name="rol" defaultValue={role ?? ""} aria-label="Filtrar por rol" className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm">
          <option value="">Todos los roles</option>
          <option value="user">Jugadores</option>
          <option value="organizer">Organizadores</option>
          <option value="admin">Administradores</option>
        </select>
        <button className="h-9 rounded-lg bg-night px-4 text-sm font-semibold text-white">Buscar</button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-line bg-surface-2/60 text-left text-xs tracking-wide text-ink-3 uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5">Cuenta</th>
              <th scope="col" className="px-4 py-2.5">Alta</th>
              <th scope="col" className="px-4 py-2.5">Rol</th>
              <th scope="col" className="px-4 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold">
                    {u.handle ? <Link href={`/jugadores/${u.handle}`} className="hover:text-brand">{u.displayName}</Link> : u.displayName}{" "}
                    {u.isDemo && <DemoBadge />}
                  </p>
                  <p className="text-xs text-ink-3">{u.email}{u.emailVerified ? "" : " · sin confirmar"}</p>
                </td>
                <td className="px-4 py-3 text-ink-3 tabular">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  {u.id === user.id ? <Badge tone="brand">{label("role", u.role)} (tú)</Badge> : <UserRoleForm userId={u.id} role={u.role} />}
                </td>
                <td className="px-4 py-3">
                  {u.suspendedAt && <p className="mb-1 text-xs text-danger">Suspendida{u.suspensionReason ? `: ${u.suspensionReason}` : ""}</p>}
                  {u.id !== user.id && <UserSuspensionForm userId={u.id} suspended={!!u.suspendedAt} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        hrefFor={(p) => `/admin/usuarios?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { rol: role } : {}), pagina: String(p) })}`}
      />
    </>
  );
}
