import type { Metadata } from "next";
import { Shield } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/section";
import { NavLinks, type NavItem } from "@/components/layout/nav-links";
import { Avatar } from "@/components/ui/avatar";
import { canAccessAdminArea } from "@/domain/permissions";
import { unreadCount } from "@/features/notifications/service";
import { myInvitations } from "@/features/teams/queries";
import { label } from "@/i18n";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Mi panel", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const [invitations, unread] = await Promise.all([myInvitations(user.id), unreadCount(user.id)]);
  const items: NavItem[] = [
    { href: "/dashboard", label: "Resumen", exact: true },
    { href: "/dashboard/torneos", label: "Mis torneos" },
    { href: "/dashboard/partidos", label: "Mis partidos" },
    { href: "/dashboard/equipos", label: "Mis equipos" },
    { href: "/dashboard/invitaciones", label: "Invitaciones", count: invitations.length },
    { href: "/dashboard/notificaciones", label: "Notificaciones", count: unread },
    { href: "/dashboard/perfil", label: "Perfil" },
    { href: "/dashboard/ajustes", label: "Ajustes de cuenta" },
  ];
  return (
    <Container className="grid gap-8 py-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:py-10">
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
          <Avatar name={user.displayName} mediaId={user.avatarMediaId} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.displayName}</p>
            <p className="truncate text-xs text-ink-3">
              @{user.handle} · {label("role", user.role)}
            </p>
          </div>
        </div>
        <nav aria-label="Secciones del panel" className="rounded-card border border-line bg-surface p-1.5">
          <NavLinks items={items} vertical />
          {canAccessAdminArea(user) && (
            <Link href="/admin" className="mt-1 flex items-center gap-2 rounded-md border-t border-line px-3 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">
              <Shield aria-hidden className="size-4" /> Administración
            </Link>
          )}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </Container>
  );
}
