import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { canManagePlatform } from "@/domain/permissions";
import { label } from "@/i18n";
import { formatRelative } from "@/lib/format";
import { requireAdminArea } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { disputes, profiles, tournaments } from "@/server/db/schema";

export const metadata = { title: "Disputas" };

export default async function DisputesPage({ searchParams }: { searchParams: Promise<{ todas?: string }> }) {
  const user = await requireAdminArea("/admin/disputas");
  const all = (await searchParams).todas === "1";
  const db = await getDb();
  const opener = alias(profiles, "opener");
  const rows = await db
    .select({
      id: disputes.id,
      matchId: disputes.matchId,
      status: disputes.status,
      reason: disputes.reason,
      createdAt: disputes.createdAt,
      tournamentName: tournaments.name,
      tournamentSlug: tournaments.slug,
      accessCode: tournaments.accessCode,
      openerName: opener.displayName,
    })
    .from(disputes)
    .innerJoin(tournaments, eq(tournaments.id, disputes.tournamentId))
    .leftJoin(opener, eq(opener.userId, disputes.openedById))
    .where(and(all ? undefined : eq(disputes.status, "open"), canManagePlatform(user) ? undefined : eq(tournaments.organizerId, user.id)))
    .orderBy(desc(disputes.createdAt))
    .limit(100);

  return (
    <>
      <DashboardTitle
        title="Disputas"
        description="Incidencias abiertas por los capitanes. Mientras una disputa está abierta, el resultado de ese partido no se puede validar."
        actions={
          <Link href={all ? "/admin/disputas" : "/admin/disputas?todas=1"} className="text-sm font-semibold text-ink-2 hover:text-brand">
            {all ? "Ver solo abiertas" : "Ver también cerradas"}
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Sin disputas abiertas">Todo en orden.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/torneos/${d.tournamentSlug}/partidos/${d.matchId}${d.accessCode ? `?codigo=${d.accessCode}` : ""}`}
                  className="flex flex-wrap items-start gap-3 px-4 py-4 hover:bg-surface-2/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{d.tournamentName}</p>
                    <p className="line-clamp-2 text-sm text-ink-2">{d.reason}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      Abierta por {d.openerName ?? "—"} · {formatRelative(d.createdAt)}
                    </p>
                  </div>
                  <Badge tone={d.status === "open" ? "danger" : "neutral"}>{label("disputeStatus", d.status)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
