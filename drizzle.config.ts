import { defineConfig } from "drizzle-kit";

/**
 * `npm run db:generate` compara el esquema con la última migración y escribe la siguiente en `drizzle/`.
 * Una migración ya aplicada no se edita nunca: los cambios van en una migración nueva.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
