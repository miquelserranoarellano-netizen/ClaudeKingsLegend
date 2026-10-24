import { Bell } from "lucide-react";
import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { markReadAction } from "@/features/notifications/actions";
import { listNotifications, unreadCount } from "@/features/notifications/service";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { requireUser } from "@/server/auth/session";
import { isMailConfigured } from "@/server/mail";

export const metadata = { title: "Notificaciones" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const user = await requireUser("/dashboard/notificaciones");
  const page = Math.max(1, Number((await searchParams).pagina) || 1);
  const [{ items, hasMore }, unread] = await Promise.all([listNotifications(user.id, page), unreadCount(user.id)]);
  return (
    <>
      <DashboardTitle
        title="Notificaciones"
        description={
          isMailConfigured()
            ? "También te llegan por correo si lo tienes activado en tu perfil."
            : "Solo dentro de la plataforma: el envío por correo no está configurado en este servidor."
        }
        actions={
          unread > 0 ? (
            <ActionButton action={markReadAction} fields={{}} variant="outline" showSuccess={false}>
              Marcar todas como leídas
            </ActionButton>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="Sin notificaciones">
          Te avisaremos de invitaciones, inscripciones, horarios, resultados y disputas.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-3 px-4 py-4", !n.readAt && "bg-brand-soft/40")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-line" : "bg-brand")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {n.link ? (
                      <Link href={n.link} className="hover:text-brand">
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                    {!n.readAt && <span className="sr-only"> (sin leer)</span>}
                  </p>
                  {n.body && <p className="text-sm text-ink-2">{n.body}</p>}
                  <p className="mt-1 text-xs text-ink-3" title={formatDateTime(n.createdAt)}>
                    {formatRelative(n.createdAt)}
                  </p>
                </div>
                {!n.readAt && (
                  <ActionButton action={markReadAction} fields={{ id: n.id }} size="sm" variant="ghost" showSuccess={false}>
                    Marcar leída
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Pagination page={page} pageCount={hasMore ? page + 1 : page} hrefFor={(p) => `/dashboard/notificaciones?pagina=${p}`} />
    </>
  );
}
