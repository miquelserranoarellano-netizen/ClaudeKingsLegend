import "server-only";
import { and, asc, desc, eq, ilike, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { canManagePlatform, type GlobalRole } from "@/domain/permissions";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { profiles, sessions, users } from "@/server/db/schema";
import { AppError, forbidden, notFound } from "@/server/errors";

export async function listUsers(actor: CurrentUser, filters: { q?: string; role?: GlobalRole; suspended?: boolean; page?: number }) {
  if (!canManagePlatform(actor)) throw forbidden();
  const db = await getDb();
  const pageSize = 30;
  const page = Math.max(1, filters.page ?? 1);
  const q = filters.q?.replace(/[%_\\]/g, "\\$&");
  const where = and(
    q ? or(ilike(users.email, `%${q}%`), ilike(profiles.displayName, `%${q}%`), ilike(profiles.handle, `%${q}%`)) : undefined,
    filters.role ? eq(users.role, filters.role) : undefined,
    filters.suspended === undefined ? undefined : filters.suspended ? isNotNull(users.suspendedAt) : isNull(users.suspendedAt),
  );
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
        role: users.role,
        suspendedAt: users.suspendedAt,
        suspensionReason: users.suspensionReason,
        createdAt: users.createdAt,
        isDemo: users.isDemo,
        displayName: profiles.displayName,
        handle: profiles.handle,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt), asc(users.email))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(where),
  ]);
  const total = count?.total ?? 0;
  return { items: rows, page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total };
}

async function assertNotLastAdmin(userId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "admin"), isNull(users.suspendedAt), ne(users.id, userId)));
  if ((row?.count ?? 0) === 0) throw new AppError("invalid_state", "errors.lastAdmin");
}

export async function setUserRole(actor: CurrentUser, userId: string, role: GlobalRole): Promise<void> {
  if (!canManagePlatform(actor)) throw forbidden();
  if (userId === actor.id) throw new AppError("invalid_state", "errors.cannotChangeOwnRole");
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!target) throw notFound();
    if (target.role === "admin" && role !== "admin") await assertNotLastAdmin(userId);
    await tx.update(users).set({ role }).where(eq(users.id, userId));
    await audit(tx, { actorId: actor.id, action: "user.role", entityType: "user", entityId: userId, data: { before: target.role, after: role } });
  });
}

/** Suspender cierra al momento todas las sesiones de la cuenta y le impide volver a entrar. */
export async function setUserSuspension(actor: CurrentUser, userId: string, suspend: boolean, reason: string | null): Promise<void> {
  if (!canManagePlatform(actor)) throw forbidden();
  if (userId === actor.id) throw new AppError("invalid_state", "errors.cannotChangeOwnRole");
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!target) throw notFound();
    if (suspend && target.role === "admin") await assertNotLastAdmin(userId);
    await tx
      .update(users)
      .set(suspend ? { suspendedAt: new Date(), suspensionReason: reason } : { suspendedAt: null, suspensionReason: null })
      .where(eq(users.id, userId));
    if (suspend) await tx.delete(sessions).where(eq(sessions.userId, userId));
    await audit(tx, {
      actorId: actor.id,
      action: suspend ? "user.suspend" : "user.reactivate",
      entityType: "user",
      entityId: userId,
      data: { reason },
    });
  });
}
