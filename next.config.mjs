import path from "node:path";
import { fileURLToPath } from "node:url";

// JavaScript (no TypeScript) a propósito: así `next start` en producción no necesita el paquete
// `typescript`, que es solo de desarrollo.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
/** Compilación para Cloudflare Workers (la define `scripts/build.mjs`; ver docs/DESPLIEGUE-CLOUDFLARE.md). */
const forCloudflare = process.env.KL_DEPLOY_TARGET === "cloudflare";

/**
 * Política de seguridad de contenidos. Solo recursos del propio dominio (y, en imágenes, el arte de Data Dragon
 * de la portada); sin marcos de terceros ni objetos. `unsafe-inline` en scripts es necesario para los scripts
 * que inyecta Next sin nonces (ver docs/ARQUITECTURA.md, «Seguridad»: pasar a nonces es una mejora
 * pendiente). En desarrollo no se aplica (recarga en caliente).
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Data Dragon: el CDN público de Riot con el arte de League of Legends de la portada (src/components/landing/lol-art.ts).
  "img-src 'self' data: blob: https://ddragon.leagueoflegends.com",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import("next").NextConfig} */
const nextConfig = {
  // PGlite (Postgres embebido) y `pg` cargan binarios y WASM propios: no deben empaquetarse. En Cloudflare
  // PGlite no se usa: se sustituye por un módulo vacío para no meter su WASM en el Worker.
  // `worker-mailer` (SMTP en Workers) usa `cloudflare:sockets`: Next no lo empaqueta; en Cloudflare lo hace
  // OpenNext y en Node no se carga nunca.
  serverExternalPackages: forCloudflare ? ["pg", "worker-mailer"] : ["@electric-sql/pglite", "pg", "worker-mailer"],
  turbopack: {
    // Hay otro package-lock.json más arriba (C:\Users\mique); se fija la raíz para que Turbopack no dude.
    root: projectRoot,
    ...(forCloudflare ? { resolveAlias: { "@electric-sql/pglite": "./src/server/db/pglite-unavailable.ts" } } : {}),
  },
  // Carpeta del proyecto: la base de datos local y las migraciones se buscan siempre aquí.
  env: { KL_PROJECT_ROOT: projectRoot },
  poweredByHeader: false,
  experimental: {
    // Subidas de imágenes (logotipos, banners y evidencias, ya reducidas en el navegador).
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ...(isProd
        ? [
            { key: "Content-Security-Policy", value: csp },
            { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          ]
        : []),
    ];
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", headers: security },
      // Zonas privadas: nunca se indexan.
      { source: "/dashboard", headers: noindex },
      { source: "/dashboard/:path*", headers: noindex },
      { source: "/admin", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
      { source: "/api/:path*", headers: noindex },
    ];
  },
};

export default nextConfig;
