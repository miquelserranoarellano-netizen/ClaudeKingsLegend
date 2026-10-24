import "server-only";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { canManagePlatform, canManageTournament } from "@/domain/permissions";
import { checkbox, optionalText, text } from "@/lib/validation";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { announcements, tournaments } from "@/server/db/schema";
import { forbidden, notFound } from "@/server/errors";

export const announcementSchema = z.object({
  title: text(3, 120),
  body: text(10, 8000),
  pinned: checkbox,
  publish: checkbox,
  tournamentId: optionalText(64),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;

/** Anuncios generales: administradores. Anuncios de un torneo: también quien lo gestiona. */
async function assertCanManage(actor: CurrentUser, tournamentId: string | null): Promise<void> {
  if (canManagePlatform(actor)) return;
  if (!tournamentId) throw forbidden();
  const db = await getDb();
  const [t] = await db.select({ organizerId: tournaments.organizerId }).from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!t || !canManageTournament(actor, t)) throw forbidden();
}

export async function saveAnnouncement(actor: CurrentUser, id: string | null, input: AnnouncementInput): Promise<string> {
  await assertCanManage(actor, input.tournamentId);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const values = {
      title: input.title,
      body: input.body,
      pinned: input.pinned,
      tournamentId: input.tournamentId,
      status: input.publish ? ("published" as const) : ("draft" as const),
    };
    if (id) {
      const [current] = await tx.select().from(announcements).where(eq(announcements.id, id)).for("update");
      if (!current) throw notFound();
      await assertCanManage(actor, current.tournamentId);
      await tx
        .update(announcements)
        .set({ ...values, publishedAt: input.publish ? (current.publishedAt ?? new Date()) : null })
        .where(eq(announcements.id, id));
      await audit(tx, { actorId: actor.id, action: "announcement.update", entityType: "announcement", entityId: id, tournamentId: input.tournamentId, data: { before: { title: current.title, status: current.status }, after: { title: values.title, status: values.status } } });
      return id;
    }
    const [row] = await tx
      .insert(announcements)
      .values({ ...values, authorId: actor.id, publishedAt: input.publish ? new Date() : null })
      .returning({ id: announcements.id });
    await audit(tx, { actorId: actor.id, action: "announcement.create", entityType: "announcement", entityId: row!.id, tournamentId: input.tournamentId, data: { title: values.title, status: values.status } });
    return row!.id;
  });
}

export async function deleteAnnouncement(actor: CurrentUser, id: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(announcements).where(eq(announcements.id, id)).for("update");
    if (!current) throw notFound();
    await assertCanManage(actor, current.tournamentId);
    await audit(tx, { actorId: actor.id, action: "announcement.delete", entityType: "announcement", entityId: id, tournamentId: current.tournamentId, data: { title: current.title } });
    await tx.delete(announcements).where(eq(announcements.id, id));
  });
}

export async function listPublishedAnnouncements(options: { page?: number; pageSize?: number; tournamentId?: string | null }) {
  const db = await getDb();
  const pageSize = options.pageSize ?? 10;
  const page = Math.max(1, options.page ?? 1);
  const where = and(
    eq(announcements.status, "published"),
    options.tournamentId === undefined ? undefined : options.tournamentId === null ? isNull(announcements.tournamentId) : eq(announcements.tournamentId, options.tournamentId),
    // Los anuncios de torneos privados no salen en los listados generales.
    options.tournamentId ? undefined : or(isNull(announcements.tournamentId), eq(tournaments.visibility, "public")),
  );
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        pinned: announcements.pinned,
        publishedAt: announcements.publishedAt,
        isDemo: announcements.isDemo,
        tournamentName: tournaments.name,
        tournamentSlug: tournaments.slug,
        tournamentVisibility: tournaments.visibility,
      })
      .from(announcements)
      .leftJoin(tournaments, eq(tournaments.id, announcements.tournamentId))
      .where(where)
      .orderBy(desc(announcements.pinned), desc(announcements.publishedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(announcements)
      .leftJoin(tournaments, eq(tournaments.id, announcements.tournamentId))
      .where(where),
  ]);
  const total = count?.total ?? 0;
  return { items: rows, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAnnouncement(id: string) {
  const db = await getDb();
  const [row] = await db
    .select({ a: announcements, tournamentName: tournaments.name, tournamentSlug: tournaments.slug, tournamentVisibility: tournaments.visibility })
    .from(announcements)
    .leftJoin(tournaments, eq(tournaments.id, announcements.tournamentId))
    .where(eq(announcements.id, id));
  return row ?? null;
}

export async function listAllAnnouncements(actor: CurrentUser) {
  const db = await getDb();
  return db
    .select({ a: announcements, tournamentName: tournaments.name })
    .from(announcements)
    .leftJoin(tournaments, eq(tournaments.id, announcements.tournamentId))
    .where(canManagePlatform(actor) ? undefined : eq(tournaments.organizerId, actor.id))
    .orderBy(desc(announcements.createdAt))
    .limit(200);
}
