/**
 * Sustituye a `@electric-sql/pglite` al compilar para Cloudflare (ver `next.config.mjs`). Allí la base de
 * datos es siempre Postgres (Supabase), y PGlite (Postgres en WASM, solo para desarrollo y pruebas) añadiría
 * varios megas al Worker y alargaría su arranque.
 */
export class PGlite {
  constructor() {
    throw new Error("PGlite no está disponible en Cloudflare: configura Hyperdrive o DATABASE_URL.");
  }
}

export const types = {};
