import "server-only";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Conexión a Postgres con Drizzle. Tres casos:
 *
 * - **Cloudflare Workers** (producción en Cloudflare, ver `docs/DESPLIEGUE-CLOUDFLARE.md`): una conexión
 *   por petición, como exige el entorno (un Worker no puede reutilizar una conexión de otra petición). Se
 *   usa Hyperdrive si está enlazado (`HYPERDRIVE` en `wrangler.jsonc`) y, si no, `DATABASE_URL`.
 * - **Node con `DATABASE_URL`** (Docker, VPS…): un *pool* compartido con el controlador `pg`. Las
 *   migraciones se aplican aparte, con `npm run db:migrate`, antes de arrancar.
 * - **Sin `DATABASE_URL`** (desarrollo): PGlite, Postgres real compilado a WASM guardado en `.data/pg`. Las
 *   migraciones se aplican solas al abrirla. En producción solo se permite con `ALLOW_PGLITE=1`.
 *
 * Todos hablan el mismo SQL: el esquema, las migraciones y las consultas son idénticos.
 */

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

/**
 * Carpeta del proyecto. No se usa `process.cwd()` a secas porque el servidor puede arrancarse desde otra
 * carpeta y la base de datos local o las migraciones acabarían buscándose en otro sitio.
 */
export function projectRoot(): string {
  return process.env.KL_PROJECT_ROOT || process.cwd();
}

export function migrationsFolder(): string {
  return path.join(projectRoot(), "drizzle");
}

export function dataDir(): string {
  return process.env.DATA_DIR?.trim() || path.join(projectRoot(), ".data");
}

/** Abre una base PGlite y aplica las migraciones. Sin carpeta, vive en memoria (pruebas). */
export async function openPglite(dir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dir) await mkdir(dir, { recursive: true });
  const client = dir ? new PGlite(dir) : new PGlite();
  await client.waitReady;
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return db as unknown as Db;
}

function openPostgres(url: string, max: number): Db {
  const pool = new Pool({
    connectionString: url,
    max,
    // TLS según la propia URL (`?sslmode=require` en servicios gestionados).
  });
  pool.on("error", (error, client) => {
    // Al cerrar a propósito una conexión, el socket puede avisar de que se ha cerrado: no es un fallo.
    // Los errores de conexiones que no estábamos cerrando sí se registran.
    if ((client as unknown as { _ending?: boolean })._ending) return;
    console.error("[db] error en una conexión inactiva:", error.message);
  });
  return drizzlePostgres({ client: pool, schema }) as unknown as Db;
}

// --- Cloudflare Workers -------------------------------------------------------------------------------

interface CloudflareBindings {
  /** Hyperdrive: grupo de conexiones de Cloudflare delante de Supabase (opcional pero recomendado). */
  HYPERDRIVE?: { connectionString: string };
}

/** `true` dentro de un Worker de Cloudflare (workerd). En Node, `navigator.userAgent` es «Node.js/…». */
export function isCloudflareWorker(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

/** Una base de datos por petición: la clave es el contexto de ejecución de esa petición. */
const workerDbs = new WeakMap<object, Db>();

function workerDb(): Db {
  const { env, ctx } = getCloudflareContext();
  let db = workerDbs.get(ctx);
  if (!db) {
    const url = (env as CloudflareBindings).HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error(
        "Falta la base de datos: enlaza Hyperdrive (HYPERDRIVE) o define el secreto DATABASE_URL (ver docs/DESPLIEGUE-CLOUDFLARE.md).",
      );
    }
    // Pocas conexiones: las consultas en paralelo de una misma página (un Worker admite como mucho 6
    // conexiones abiertas a la vez). Se reutilizan durante la petición y Cloudflare las cierra al terminar
    // (comprobado: ninguna queda abierta). Hyperdrive mantiene las conexiones de verdad con Supabase.
    db = openPostgres(url, Number(process.env.DATABASE_POOL_MAX) || 4);
    workerDbs.set(ctx, db);
  }
  return db;
}

// --- Acceso -------------------------------------------------------------------------------------------

// En Node la conexión se guarda en `globalThis` para sobrevivir a la recarga en caliente de desarrollo:
// PGlite solo admite un proceso abierto sobre la misma carpeta.
const globalForDb = globalThis as typeof globalThis & { __klDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (isCloudflareWorker()) return Promise.resolve(workerDb());
  if (!globalForDb.__klDb) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url && process.env.NODE_ENV === "production" && process.env.ALLOW_PGLITE !== "1") {
      throw new Error("Falta DATABASE_URL. En producción hace falta un Postgres (ver docs/DESPLIEGUE.md).");
    }
    const opening = url
      ? Promise.resolve(openPostgres(url, Number(process.env.DATABASE_POOL_MAX) || 10))
      : openPglite(path.join(dataDir(), "pg"));
    globalForDb.__klDb = opening;
    opening.catch(() => {
      // Si falla (credenciales, red…), la siguiente petición vuelve a intentarlo.
      if (globalForDb.__klDb === opening) globalForDb.__klDb = undefined;
    });
  }
  return globalForDb.__klDb;
}

/**
 * Base de datos para objetos que viven más que una petición (Better Auth se crea una sola vez). En Node es
 * la misma de siempre. En Cloudflare es un intermediario que, en cada uso, delega en la conexión de la
 * petición en curso: guardar la conexión de la primera petición haría fallar todas las siguientes.
 */
export function getLongLivedDb(): Promise<Db> {
  if (!isCloudflareWorker()) return getDb();
  const forwarder = new Proxy({} as Db, {
    get(_target, property) {
      if (property === "then") return undefined; // No es una promesa.
      const db = workerDb();
      const value = Reflect.get(db, property, db);
      return typeof value === "function" ? value.bind(db) : value;
    },
  });
  return Promise.resolve(forwarder);
}

/** Solo para pruebas: sustituye la base de datos global (normalmente por una en memoria). */
export function setDbForTests(db: Db | undefined): void {
  globalForDb.__klDb = db ? Promise.resolve(db) : undefined;
}

export { schema };
