// Aplica las migraciones pendientes de `drizzle/` contra el Postgres de DATABASE_URL.
//
//   npm run db:migrate
//
// En Docker se ejecuta solo al arrancar el contenedor, antes de la aplicación. Cada migración se aplica
// una sola vez (Drizzle guarda las aplicadas en `drizzle.__drizzle_migrations`). Una migración ya aplicada
// no se edita nunca: los cambios van en una nueva (`npm run db:generate`).
//
// En desarrollo, sin DATABASE_URL, no hace falta: la base local (PGlite) se migra sola al abrirse.
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Falta DATABASE_URL. En desarrollo no hace falta este comando: la base local se migra sola.");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { default: pg } = await import("pg");
const { drizzle } = await import("drizzle-orm/node-postgres");
const { migrate } = await import("drizzle-orm/node-postgres/migrator");

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  // Bloqueo consultivo: si arrancan dos instancias a la vez, la segunda espera a la primera.
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(727274)");
    await migrate(drizzle({ client }), { migrationsFolder: path.join(root, "drizzle") });
    await client.query("select pg_advisory_unlock(727274)");
  } finally {
    client.release();
  }
  console.log("Migraciones aplicadas.");
} catch (error) {
  console.error("Error al aplicar las migraciones:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
