import "server-only";
import type { DbOrTx } from "./db/client";
import { auditLogs } from "./db/schema";

export type AuditEntity =
  | "user"
  | "profile"
  | "team"
  | "team_member"
  | "team_invitation"
  | "tournament"
  | "registration"
  | "participant"
  | "stage"
  | "match"
  | "match_result"
  | "dispute"
  | "announcement"
  | "content_page"
  | "setting";

/**
 * Añade una entrada al registro de auditoría dentro de la misma transacción que el cambio: si el cambio
 * se deshace, la entrada también. `data` lleva el antes y el después de lo que cambió; nunca contraseñas,
 * tokens ni datos de contacto.
 */
export async function audit(
  db: DbOrTx,
  entry: {
    actorId: string | null;
    action: string;
    entityType: AuditEntity;
    entityId: string;
    tournamentId?: string | null;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    tournamentId: entry.tournamentId ?? null,
    data: entry.data ?? null,
  });
}
