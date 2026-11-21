import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

/**
 * Adaptador OpenNext para Cloudflare Workers.
 *
 * Todas las páginas se renderizan en cada petición (dependen de la sesión y de resultados en vivo); lo poco
 * que se genera al compilar (icono, imagen para redes) se sirve desde los recursos estáticos del Worker, sin
 * R2 ni KV que configurar.
 */
export default {
  ...defineCloudflareConfig({ incrementalCache: staticAssetsIncrementalCache }),
  // OpenNext ejecuta este comando para compilar Next.js. `scripts/build.mjs --next` hace `next build` con la
  // configuración de Cloudflare (sin la base local PGlite, que no se usa allí).
  buildCommand: "node scripts/build.mjs --next",
};
