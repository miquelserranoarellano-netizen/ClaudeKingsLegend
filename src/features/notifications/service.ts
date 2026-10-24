import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { t, type MessageKey } from "@/i18n";
import { siteUrl } from "@/lib/site";
import { type DbOrTx, getDb } from "@/server/db/client";
import { notifications, profiles, users } from "@/server/db/schema";
import { isMailConfigured, sendMail } from "@/server/mail";

/**
 * Avisos dentro de la aplicación. Se crean dentro de la misma transacción que el cambio que los provoca:
 * si el cambio falla, no queda un aviso huérfano. Si hay SMTP configurado y el usuario no lo ha
 * desactivado, se marcan para enviarse también por correo cuando la respuesta ya ha salido.
 */

export type NotificationType =
  | "teamInvitation"
  | "invitationAccepted"
  | "invitationDeclined"
  | "removedFromTeam"
  | "captaincyTransferred"
  | "registrationApproved"
  | "registrationRejected"
  | "registrationWaitlisted"
  | "registrationPending"
  | "tournamentStarted"
  | "tournamentCancelled"
  | "matchScheduled"
  | "matchRescheduled"
  | "resultReported"
  | "resultConfirmed"
  | "resultCorrected"
  | "disputeOpened"
  | "disputeResolved";

export async function notify(
  db: DbOrTx,
  userIds: Iterable<string>,
  type: NotificationType,
  params: Record<string, string | number>,
  link: string | null,
): Promise<void> {
  const recipients = [...new Set(userIds)];
  if (recipients.length === 0) return;
  const title = t(`notifications.${type}.title` as MessageKey, params);
  const body = t(`notifications.${type}.body` as MessageKey, params).trim() || null;
  const email = isMailConfigured();
  await db.insert(notifications).values(
    recipients.map((userId) => ({ userId, type, title, body, link, data: params, emailPending: email })),
  );
}

export async function listNotifications(userId: string, page: number, pageSize = 20) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function unreadCount(userId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.count ?? 0;
}

/** Marca como leídos los avisos indicados (o todos). Solo los del propio usuario. */
export async function markRead(userId: string, ids: string[] | "all"): Promise<void> {
  const db = await getDb();
  const own = eq(notifications.userId, userId);
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(own, isNull(notifications.readAt), ids === "all" ? undefined : inArray(notifications.id, ids)));
}

/**
 * Envía por correo los avisos pendientes. Primero los «reclama» (los desmarca en una sola sentencia), así
 * dos llamadas simultáneas nunca envían el mismo correo dos veces.
 */
export async function deliverPendingEmails(limit = 50): Promise<number> {
  if (!isMailConfigured()) return 0;
  const db = await getDb();
  const claimed = await db
    .update(notifications)
    .set({ emailPending: false })
    .where(
      inArray(
        notifications.id,
        db
          .select({ id: notifications.id })
          .from(notifications)
          .where(eq(notifications.emailPending, true))
          .limit(limit),
      ),
    )
    .returning({ id: notifications.id, userId: notifications.userId, title: notifications.title, body: notifications.body, link: notifications.link });
  if (claimed.length === 0) return 0;

  const recipients = await db
    .select({ id: users.id, email: users.email, wants: profiles.notifyByEmail })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(inArray(users.id, [...new Set(claimed.map((n) => n.userId))]));
  const byId = new Map(recipients.map((r) => [r.id, r]));

  let sent = 0;
  for (const item of claimed) {
    const recipient = byId.get(item.userId);
    if (!recipient?.wants) continue;
    const link = item.link ? `\n\n${siteUrl()}${item.link}` : "";
    await sendMail({ to: recipient.email, subject: `${item.title} · Kings Legend`, text: `${item.body ?? ""}${link}` });
    await db.update(notifications).set({ emailedAt: new Date() }).where(eq(notifications.id, item.id));
    sent += 1;
  }
  return sent;
}
