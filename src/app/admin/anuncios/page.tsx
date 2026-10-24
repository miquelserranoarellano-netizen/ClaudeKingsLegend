import { and, asc, eq, inArray } from "drizzle-orm";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { canManagePlatform } from "@/domain/permissions";
import { deleteAnnouncementAction } from "@/features/admin/actions";
import { AnnouncementForm } from "@/features/admin/components/admin-forms";
import { listAllAnnouncements } from "@/features/announcements/service";
import { label } from "@/i18n";
import { formatDate } from "@/lib/format";
import { requireAdminArea } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { tournaments } from "@/server/db/schema";

export const metadata = { title: "Anuncios" };

export default async function AnnouncementsAdminPage({ searchParams }: { searchParams: Promise<{ editar?: string; nuevo?: string; guardado?: string }> }) {
  const user = await requireAdminArea("/admin/anuncios");
  const params = await searchParams;
  const admin = canManagePlatform(user);
  const db = await getDb();
  const [items, ownTournaments] = await Promise.all([
    listAllAnnouncements(user),
    db
      .select({ id: tournaments.id, name: tournaments.name })
      .from(tournaments)
      .where(and(admin ? undefined : eq(tournaments.organizerId, user.id), inArray(tournaments.status, ["draft", "published", "in_progress", "completed"])))
      .orderBy(asc(tournaments.name)),
  ]);
  const editing = params.editar ? items.find((i) => i.a.id === params.editar) : undefined;
  const showForm = !!editing || params.nuevo === "1";

  return (
    <>
      <DashboardTitle
        title="Anuncios"
        description={admin ? "Noticias generales y anuncios de torneos." : "Anuncios de tus torneos (los generales los publica la administración)."}
        actions={!showForm ? <ButtonLink href="/admin/anuncios?nuevo=1">Nuevo anuncio</ButtonLink> : undefined}
      />
      {params.guardado && (
        <p role="status" className="mb-4 rounded-lg bg-open-soft px-4 py-2.5 text-sm text-open">Anuncio guardado.</p>
      )}
      {showForm && (
        <Card className="mb-6">
          <CardHeader title={editing ? "Editar anuncio" : "Nuevo anuncio"} action={<Link href="/admin/anuncios" className="text-sm font-semibold text-ink-2 hover:text-ink">Cancelar</Link>} />
          <CardBody className="py-5">
            <AnnouncementForm
              tournaments={ownTournaments}
              announcement={editing ? { id: editing.a.id, title: editing.a.title, body: editing.a.body, pinned: editing.a.pinned, status: editing.a.status, tournamentId: editing.a.tournamentId } : undefined}
            />
          </CardBody>
        </Card>
      )}
      {items.length === 0 ? (
        !showForm && <EmptyState icon={Megaphone} title="Sin anuncios">Publica novedades, cambios de horario o recordatorios.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {items.map(({ a, tournamentName }) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-xs text-ink-3">
                    {tournamentName ?? "General"} · {a.publishedAt ? `publicado el ${formatDate(a.publishedAt)}` : "sin publicar"}
                  </p>
                </div>
                <Badge tone={a.status === "published" ? "open" : "neutral"}>{label("announcementStatus", a.status)}</Badge>
                {a.pinned && <Badge tone="brand">Fijado</Badge>}
                <ButtonLink href={`/admin/anuncios?editar=${a.id}`} variant="ghost" size="sm">Editar</ButtonLink>
                <ActionButton action={deleteAnnouncementAction} fields={{ id: a.id }} variant="ghost" size="sm" showSuccess={false}>
                  Eliminar
                </ActionButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
