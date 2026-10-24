import "server-only";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Conexión a Postgres con Drizzle.
 *
 * - Con `DATABASE_URL`: el controlador `pg` contra un Postgres de verdad (producción, Docker…). Las
 *   migraciones se aplican aparte, con `npm run db:migrate`, antes de arrancar.
 * - Sin `DATABASE_URL` (desarrollo): PGlite, Postgres real compilado a WASM guardado en `.data/pg`. Las
 *   migraciones se aplican solas al abrirla. En producción solo se permite con `ALLOW_PGLITE=1`.
 *
 * Los dos hablan el mismo SQL: el esquema, las migraciones y las consultas son idénticos.
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

async function openPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    // TLS según la propia URL (`?sslmode=require` en servicios gestionados).
  });
  pool.on("error", (error) => {
    console.error("[db] error en una conexión inactiva:", error.message);
  });
  return drizzle({ client: pool, schema }) as unknown as Db;
}

// La conexión se guarda en `globalThis` para sobrevivir a la recarga en caliente de desarrollo:
// PGlite solo admite un proceso abierto sobre la misma carpeta.
const globalForDb = globalThis as typeof globalThis & { __klDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__klDb) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url && process.env.NODE_ENV === "production" && process.env.ALLOW_PGLITE !== "1") {
      throw new Error("Falta DATABASE_URL. En producción hace falta un Postgres (ver docs/DESPLIEGUE.md).");
    }
    const opening = url ? openPostgres(url) : openPglite(path.join(dataDir(), "pg"));
    globalForDb.__klDb = opening;
    opening.catch(() => {
      // Si falla (credenciales, red…), la siguiente petición vuelve a intentarlo.
      if (globalForDb.__klDb === opening) globalForDb.__klDb = undefined;
    });
  }
  return globalForDb.__klDb;
}

/** Solo para pruebas: sustituye la base de datos global (normalmente por una en memoria). */
export function setDbForTests(db: Db | undefined): void {
  globalForDb.__klDb = db ? Promise.resolve(db) : undefined;
}

export { schema };
