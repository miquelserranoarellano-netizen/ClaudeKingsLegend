import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { type Actor, canAccessAdminArea, canManagePlatform } from "@/domain/permissions";
import { getDb } from "../db/client";
import { profiles, users } from "../db/schema";
import { unauthenticated } from "../errors";
import { getAuth } from "./auth";
import { ensureProfile } from "./profile-bootstrap";

/**
 * Capa de acceso a la sesión. Toda página privada, acción de servidor y ruta empieza por una de estas
 * funciones: validan la sesión contra la base de datos y leen el rol en ese momento (no de una cookie),
 * así que un cambio de rol o una suspensión tienen efecto inmediato.
 */

export interface CurrentUser extends Actor {
  email: string;
  emailVerified: boolean;
  handle: string;
  displayName: string;
  avatarMediaId: string | null;
  hasRiotId: boolean;
}

async function loadUser(userId: string): Promise<CurrentUser | null> {
  const db = await getDb();
  const select = () =>
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        role: users.role,
        suspendedAt: users.suspendedAt,
        handle: profiles.handle,
        displayName: profiles.displayName,
        avatarMediaId: profiles.avatarMediaId,
        riotGameName: profiles.riotGameName,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, userId));

  let [row] = await select();
  if (!row || row.suspendedAt) return null;
  if (!row.handle) {
    await ensureProfile(db, row.id, row.name);
    [row] = await select();
    if (!row) return null;
  }
  return {
    id: row.id,
    role: row.role,
    suspended: false,
    email: row.email,
    emailVerified: row.emailVerified,
    handle: row.handle!,
    displayName: row.displayName ?? row.name,
    avatarMediaId: row.avatarMediaId,
    hasRiotId: row.riotGameName !== null,
  };
}

/** Usuario de la petición actual, o `null`. Se memoriza durante la petición. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return loadUser(session.user.id);
});

/** Para páginas: sin sesión, redirige al acceso y vuelve después a `next`. */
export async function requireUser(next = "/dashboard"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/acceso?next=${encodeURIComponent(next)}`);
  return user;
}

/** Área /admin: organizadores y administradores. A los demás se les responde como si no existiera. */
export async function requireAdminArea(next = "/admin"): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!canAccessAdminArea(user)) notFound();
  return user;
}

/** Secciones solo para administradores (usuarios, ajustes, auditoría…). */
export async function requirePlatformAdmin(next = "/admin"): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!canManagePlatform(user)) notFound();
  return user;
}

/** Para acciones de servidor: sin sesión, error (la acción lo devuelve como mensaje). */
export async function actorOrThrow(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}
