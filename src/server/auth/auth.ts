import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { getDb, type Db } from "../db/client";
import { accounts, sessions, users, verifications } from "../db/schema";
import { isMailConfigured, sendMail } from "../mail";
import { consumeRateLimit } from "../rate-limit";
import { ensureProfile } from "./profile-bootstrap";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import { siteUrl } from "@/lib/site";

/**
 * Autenticación con Better Auth (sucesor mantenido de Auth.js):
 * - Correo y contraseña, con hash scrypt; la contraseña nunca se guarda ni se registra en claro.
 * - Sesiones en la base de datos; el navegador solo guarda un token aleatorio en una cookie HttpOnly,
 *   Secure en producción y SameSite=Lax. Comprobación de origen (CSRF) en todas las peticiones.
 * - Verificación del correo y recuperación de contraseña cuando hay SMTP configurado.
 * - Límite de intentos guardado en Postgres.
 * - Las cuentas suspendidas no pueden abrir sesión.
 */

function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET debe tener al menos 32 caracteres en producción (ver .env.example).");
  }
  return "solo-desarrollo-kings-legend-no-usar-en-produccion";
}

function createAuth(db: Db) {
  const mail = isMailConfigured();
  return betterAuth({
    appName: "Kings Legend",
    baseURL: siteUrl(),
    secret: authSecret(),
    trustedOrigins: [siteUrl()],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      // Sin servidor de correo no se puede exigir la verificación: nadie podría entrar.
      requireEmailVerification: mail,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await sendMail({
          to: user.email,
          subject: "Restablece tu contraseña de Kings Legend",
          text: `Hola, ${user.name}:\n\nPara elegir una contraseña nueva, abre este enlace (caduca en 1 hora):\n${url}\n\nSi no lo has pedido tú, ignora este mensaje: tu contraseña no cambiará.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: mail,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail({
          to: user.email,
          subject: "Confirma tu correo en Kings Legend",
          text: `Hola, ${user.name}:\n\nConfirma tu dirección de correo abriendo este enlace (caduca en 24 horas):\n${url}\n\nSi no has creado una cuenta, ignora este mensaje.`,
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      // En desarrollo se desactiva para no estorbar al probar; `AUTH_RATE_LIMIT=1` lo activa.
      enabled: process.env.NODE_ENV === "production" || process.env.AUTH_RATE_LIMIT === "1",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 300, max: 10 },
        "/sign-up/email": { window: 3600, max: 5 },
        "/request-password-reset": { window: 3600, max: 5 },
        "/send-verification-email": { window: 3600, max: 5 },
        "/change-password": { window: 300, max: 5 },
      },
      customStorage: { consume: (key, rule) => consumeRateLimit(db, `auth:${key}`, rule) },
    },
    advanced: {
      cookiePrefix: "kl",
      // Detrás del proxy inverso (Caddy), que sustituye esta cabecera por la IP real del cliente.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await ensureProfile(db, user.id, user.name);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const [row] = await db
              .select({ suspendedAt: users.suspendedAt })
              .from(users)
              .where(eq(users.id, session.userId));
            if (row?.suspendedAt) throw new APIError("FORBIDDEN", { message: "ACCOUNT_SUSPENDED" });
          },
        },
      },
    },
    plugins: [nextCookies()],
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as typeof globalThis & { __klAuth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  if (!globalForAuth.__klAuth) {
    const creating = getDb().then(createAuth);
    globalForAuth.__klAuth = creating;
    creating.catch(() => {
      if (globalForAuth.__klAuth === creating) globalForAuth.__klAuth = undefined;
    });
  }
  return globalForAuth.__klAuth;
}

/** Solo para pruebas: olvida la instancia para que se cree de nuevo con la base de datos de prueba. */
export function resetAuthForTests(): void {
  globalForAuth.__klAuth = undefined;
}
