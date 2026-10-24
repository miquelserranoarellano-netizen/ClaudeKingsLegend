import { and, desc, eq, sql } from "drizzle-orm";
import { ClipboardList, Plus, ShieldAlert, Trophy } from "lucide-react";
import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PhaseBadge } from "@/components/ui/status-badge";
import { canManagePlatform } from "@/domain/permissions";
import { listManagedTournaments } from "@/features/tournaments/queries";
import { formatRelative, formatShortDate } from "@/lib/format";
import { requireAdminArea } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { auditLogs, disputes, profiles, tournamentRegistrations, tournaments, users } from "@/server/db/schema";

export default async function AdminHome() {
  const user = await requireAdminArea();
  const admin = canManagePlatform(user);
  const db = await getDb();
  const scope = admin ? undefined : eq(tournaments.organizerId, user.id);
  const [managed, [pendingRegs], [openDisputes], [userCount], recent] = await Promise.all([
    listManagedTournaments(user, { page: 1 }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournamentRegistrations)
      .innerJoin(tournaments, eq(tournaments.id, tournamentRegistrations.tournamentId))
      .where(and(eq(tournamentRegistrations.status, "pending"), eq(tournaments.status, "published"), scope)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(disputes)
      .innerJoin(tournaments, eq(tournaments.id, disputes.tournamentId))
      .where(and(eq(disputes.status, "open"), scope)),
    admin ? db.select({ count: sql<number>`count(*)::int` }).from(users) : Promise.resolve([{ count: 0 }]),
    admin
      ? db
          .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, createdAt: auditLogs.createdAt, actor: profiles.displayName })
          .from(auditLogs)
          .leftJoin(profiles, eq(profiles.userId, auditLogs.actorId))
          .orderBy(desc(auditLogs.createdAt))
          .limit(8)
      : Promise.resolve([]),
  ]);
  const active = managed.items.filter((t) => ["draft", "published", "in_progress"].includes(t.status));

  const stats = [
    { label: "Torneos activos", value: active.length, href: "/admin/torneos" },
    { label: "Inscripciones por revisar", value: pendingRegs?.count ?? 0, href: "/admin/torneos" },
    { label: "Disputas abiertas", value: openDisputes?.count ?? 0, href: "/admin/disputas" },
    ...(admin ? [{ label: "Usuarios registrados", value: userCount?.count ?? 0, href: "/admin/usuarios" }] : []),
  ];

  return (
    <>
      <DashboardTitle
        title="Resumen"
        description={admin ? "Toda la plataforma." : "Los torneos que organizas."}
        actions={
          <ButtonLink href="/admin/torneos/nuevo">
            <Plus aria-hidden className="size-4" /> Nuevo torneo
          </ButtonLink>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-card border border-line bg-surface p-4 shadow-card hover:shadow-lift">
            <p className="text-sm text-ink-3">{s.label}</p>
            <p className="display mt-1 text-4xl tabular">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Torneos en marcha" />
          {active.length > 0 ? (
            <ul className="divide-y divide-line">
              {active.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <Link href={`/admin/torneos/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{t.name}</p>
                      <p className="text-xs text-ink-3">
                        {t.approvedCount}/{t.maxParticipants} · empieza el {formatShortDate(t.startsAt)}
                      </p>
                    </div>
                    <PhaseBadge phase={t.phase} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <EmptyState icon={Trophy} title="Ningún torneo activo" compact action={<ButtonLink href="/admin/torneos/nuevo" size="sm">Crear torneo</ButtonLink>}>
                Crea un borrador, revísalo y publícalo cuando esté listo.
              </EmptyState>
            </div>
          )}
        </Card>

        {admin ? (
          <Card className="overflow-hidden">
            <CardHeader title="Actividad reciente" action={<Link href="/admin/auditoria" className="text-sm font-semibold text-ink-2 hover:text-brand">Ver auditoría</Link>} />
            {recent.length > 0 ? (
              <ul className="divide-y divide-line text-sm">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <ClipboardList aria-hidden className="size-4 shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate">
                      <strong>{r.actor ?? "Sistema"}</strong> · <code className="text-xs">{r.action}</code>
                    </span>
                    <span className="shrink-0 text-xs text-ink-3">{formatRelative(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-ink-3">Sin actividad todavía.</p>
            )}
          </Card>
        ) : (
          <Card className="p-5">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert aria-hidden className="size-5 text-brand" /> Recuerda
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-2">
              <li>Publica el torneo para abrir las inscripciones en las fechas indicadas.</li>
              <li>Cierra inscripciones y pulsa «Iniciar competición» para generar el cuadro.</li>
              <li>Valida los resultados que comunican los capitanes; el cuadro avanza solo.</li>
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
