import "server-only";
import { eq } from "drizzle-orm";
import { handleFrom, randomSuffix } from "@/lib/slug";
import type { DbOrTx } from "../db/client";
import { profiles } from "../db/schema";
import { isUniqueViolation } from "../errors";

/**
 * Crea el perfil público de un usuario recién registrado, con un identificador derivado de su nombre
 * (editable después). Es idempotente: si ya existe, no hace nada. Se llama tras el registro y, por si
 * aquello fallara, también al cargar la sesión.
 */
export async function ensureProfile(db: DbOrTx, userId: string, displayName: string): Promise<void> {
  const existing = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, userId));
  if (existing.length > 0) return;

  const base = handleFrom(displayName);
  for (let attempt = 0; attempt < 6; attempt++) {
    const handle = attempt === 0 ? base : `${base.slice(0, 27)}-${randomSuffix(4)}`;
    try {
      await db.insert(profiles).values({ userId, handle, displayName: displayName.trim().slice(0, 40) || handle });
      return;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const again = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, userId));
      if (again.length > 0) return;
    }
  }
  throw new Error("No se ha podido generar un identificador de perfil único.");
}
