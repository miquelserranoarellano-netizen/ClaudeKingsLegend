import { randomUUID } from "node:crypto";
import { resetAuthForTests } from "@/server/auth/auth";
import type { CurrentUser } from "@/server/auth/session";
import { type Db, openPglite, setDbForTests } from "@/server/db/client";
import { profiles, users } from "@/server/db/schema";

/** Postgres real en memoria con todas las migraciones aplicadas, instalado como base de datos global. */
export async function useTestDb(): Promise<Db> {
  const db = await openPglite();
  setDbForTests(db);
  resetAuthForTests();
  return db;
}

let counter = 0;

/**
 * Crea un usuario con perfil directamente en la base de datos (sin pasar por Better Auth, que tiene su
 * propia prueba) y lo devuelve con la forma de la sesión.
 */
export async function createTestUser(
  db: Db,
  options: { role?: "user" | "organizer" | "admin"; name?: string; riotId?: boolean } = {},
): Promise<CurrentUser> {
  counter += 1;
  const id = randomUUID();
  const name = options.name ?? `Jugador ${counter}`;
  const handle = `jugador-${counter}-${id.slice(0, 4)}`;
  await db.insert(users).values({
    id,
    name,
    email: `${handle}@example.test`,
    emailVerified: true,
    role: options.role ?? "user",
  });
  await db.insert(profiles).values({
    userId: id,
    handle,
    displayName: name,
    riotGameName: options.riotId === false ? null : `Invocador${counter}`,
    riotTagLine: options.riotId === false ? null : "EUW",
  });
  return {
    id,
    role: options.role ?? "user",
    suspended: false,
    email: `${handle}@example.test`,
    emailVerified: true,
    handle,
    displayName: name,
    avatarMediaId: null,
    hasRiotId: options.riotId !== false,
  };
}
