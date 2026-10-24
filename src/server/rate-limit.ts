import "server-only";
import { sql } from "drizzle-orm";
import type { DbOrTx } from "./db/client";
import { rateLimits } from "./db/schema";
import { AppError } from "./errors";

/**
 * Límite de peticiones por ventana fija, guardado en Postgres: funciona igual con una instancia o con
 * varias y sobrevive a los reinicios. La comprobación y el incremento son una sola sentencia atómica.
 */
export async function consumeRateLimit(
  db: DbOrTx,
  key: string,
  rule: { window: number; max: number },
): Promise<{ allowed: boolean; retryAfter: number | null }> {
  const expired = sql`${rateLimits.windowStart} < now() - make_interval(secs => ${rule.window})`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart: new Date(), count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  if (!row || row.count <= rule.max) return { allowed: true, retryAfter: null };
  const elapsed = (Date.now() - row.windowStart.getTime()) / 1000;
  return { allowed: false, retryAfter: Math.max(1, Math.ceil(rule.window - elapsed)) };
}

/** Reglas de las acciones sensibles de la aplicación (las de autenticación están en `auth/auth.ts`). */
export const RATE_RULES = {
  createTeam: { window: 3600, max: 5 },
  invite: { window: 3600, max: 40 },
  register: { window: 3600, max: 20 },
  reportResult: { window: 600, max: 10 },
  openDispute: { window: 3600, max: 10 },
  upload: { window: 3600, max: 30 },
  createTournament: { window: 3600, max: 10 },
} as const;

export async function enforceRateLimit(db: DbOrTx, action: keyof typeof RATE_RULES, actorId: string): Promise<void> {
  const result = await consumeRateLimit(db, `app:${action}:${actorId}`, RATE_RULES[action]);
  if (!result.allowed) {
    throw new AppError("rate_limited", "errors.rateLimited", { minutes: Math.ceil((result.retryAfter ?? 60) / 60) });
  }
}
