import type { Metadata } from "next";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Container } from "@/components/layout/section";
import { NavLinks, type NavItem } from "@/components/layout/nav-links";
import { Badge } from "@/components/ui/badge";
import { canManagePlatform } from "@/domain/permissions";
import { label } from "@/i18n";
import { requireAdminArea } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { disputes, tournaments } from "@/server/db/schema";

export const metadata: Metadata = { title: { default: "Administración", template: "%s · Administración" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminArea();
  const admin = canManagePlatform(user);
  const db = await getDb();
  const [open] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(disputes)
    .innerJoin(tournaments, eq(tournaments.id, disputes.tournamentId))
    .where(and(eq(disputes.status, "open"), admin ? undefined : eq(tournaments.organizerId, user.id), inArray(tournaments.status, ["in_progress"])));

  const items: NavItem[] = [
    { href: "/admin", label: "Resumen", exact: true },
    { href: "/admin/torneos", label: admin ? "Torneos" : "Mis torneos" },
    { href: "/admin/disputas", label: "Disputas", count: open?.count ?? 0 },
    { href: "/admin/anuncios", label: "Anuncios" },
    ...(admin
      ? [
          { href: "/admin/usuarios", label: "Usuarios" },
          { href: "/admin/equipos", label: "Equipos" },
          { href: "/admin/contenido", label: "Páginas legales" },
          { href: "/admin/auditoria", label: "Auditoría" },
          { href: "/admin/ajustes", label: "Ajustes" },
        ]
      : []),
  ];

  return (
    <div>
      <div className="border-b border-line bg-night text-white">
        <Container className="flex flex-wrap items-center justify-between gap-2 py-3">
          <p className="font-display text-lg font-bold tracking-wide uppercase">Administración</p>
          <Badge tone="brand">{label("role", user.role)}</Badge>
        </Container>
      </div>
      <Container className="grid gap-8 py-8 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Secciones de administración" className="rounded-card border border-line bg-surface p-1.5 lg:sticky lg:top-24 lg:self-start">
          <NavLinks items={items} vertical />
        </nav>
        <div className="min-w-0">{children}</div>
      </Container>
    </div>
  );
}
