// Asigna un rol global a una cuenta existente. Es la forma de crear el primer administrador.
//
//   npm run admin:grant -- correo@ejemplo.com admin
//   npm run admin:grant -- correo@ejemplo.com organizer
//   npm run admin:grant -- correo@ejemplo.com user
//
// Con DATABASE_URL usa ese Postgres; sin ella, la base local de desarrollo (.data/pg). Con la base local,
// para el servidor de desarrollo antes: PGlite solo admite un proceso a la vez sobre la misma carpeta.
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROLES = ["user", "organizer", "admin"];
const [email, role = "admin"] = process.argv.slice(2);

if (!email || !email.includes("@") || !ROLES.includes(role)) {
  console.error("Uso: npm run admin:grant -- correo@ejemplo.com [admin|organizer|user]");
  process.exit(1);
}

const sql = `
  with target as (
    update users set role = $1, updated_at = now() where lower(email) = lower($2) returning id
  )
  insert into audit_logs (actor_id, action, entity_type, entity_id, data)
  select null, 'user.role.cli', 'user', id, jsonb_build_object('role', $1::text) from target
  returning entity_id`;

async function run() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const { rows } = await client.query(sql, [role, email]);
      return rows.length;
    } finally {
      await client.end();
    }
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dir = process.env.DATA_DIR?.trim() || path.join(root, ".data");
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(path.join(dir, "pg"));
  try {
    const { rows } = await db.query(sql, [role, email]);
    return rows.length;
  } finally {
    await db.close();
  }
}

run()
  .then((count) => {
    if (count === 0) {
      console.error(`No hay ninguna cuenta con el correo ${email}. Regístrate primero en la web.`);
      process.exit(1);
    }
    console.log(`Hecho: ${email} ahora tiene el rol «${role}». Cierra sesión y vuelve a entrar si no lo ves.`);
  })
  .catch((error) => {
    console.error("No se ha podido cambiar el rol:", error.message);
    process.exit(1);
  });
