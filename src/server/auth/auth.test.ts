import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { useTestDb } from "@/test/db";
import type { Db } from "../db/client";
import { accounts, profiles, users } from "../db/schema";
import { getAuth } from "./auth";

describe("registro e inicio de sesión (Better Auth contra Postgres)", () => {
  let db: Db;
  beforeAll(async () => {
    db = await useTestDb();
  });

  const email = "nueva@example.test";
  const password = "una-contraseña-larga";

  it("registra una cuenta, guarda la contraseña con hash y crea el perfil", async () => {
    const auth = await getAuth();
    const result = await auth.api.signUpEmail({ body: { name: "Nueva Jugadora", email, password } });
    expect(result.user.email).toBe(email);

    const [account] = await db.select().from(accounts).where(eq(accounts.userId, result.user.id));
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain(password);

    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, result.user.id));
    expect(profile?.handle).toBe("nueva-jugadora");
    const [user] = await db.select().from(users).where(eq(users.id, result.user.id));
    // El rol nunca llega del formulario: siempre empieza como jugador.
    expect(user?.role).toBe("user");
  });

  it("rechaza un correo repetido y una contraseña corta", async () => {
    const auth = await getAuth();
    await expect(auth.api.signUpEmail({ body: { name: "Otra", email, password } })).rejects.toThrow();
    await expect(
      auth.api.signUpEmail({ body: { name: "Corta", email: "corta@example.test", password: "123" } }),
    ).rejects.toThrow();
  });

  it("inicia sesión con la contraseña correcta y no con otra", async () => {
    const auth = await getAuth();
    const ok = await auth.api.signInEmail({ body: { email, password } });
    expect(ok.token).toBeTruthy();
    await expect(auth.api.signInEmail({ body: { email, password: "contraseña-incorrecta" } })).rejects.toThrow();
  });

  it("no deja entrar a una cuenta suspendida", async () => {
    const auth = await getAuth();
    await db.update(users).set({ suspendedAt: new Date() }).where(eq(users.email, email));
    await expect(auth.api.signInEmail({ body: { email, password } })).rejects.toThrow();
    await db.update(users).set({ suspendedAt: null }).where(eq(users.email, email));
  });

  it("valida la sesión a partir de la cookie emitida", async () => {
    const auth = await getAuth();
    const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("kl.session_token");
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookie!.split(";")[0]! }) });
    expect(session?.user.email).toBe(email);
  });
});
