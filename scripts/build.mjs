// Compilación de producción.
//
//   npm run build        → `next build` (Docker, VPS, CI). En Cloudflare Workers Builds, el Worker completo.
//   npm run build:cf     → el Worker de Cloudflare (OpenNext) desde cualquier sitio.
//
// Cloudflare Workers Builds ejecuta `npm run build` y define `WORKERS_CI=1`: en ese caso se compila
// directamente para Cloudflare, así el panel funciona con su configuración por defecto (comando de
// compilación `npm run build` y de despliegue `npx wrangler deploy`).
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const forCloudflare = args.includes("--cloudflare") || (process.env.WORKERS_CI === "1" && !args.includes("--next"));

function run(command, commandArgs, env = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

if (forCloudflare) {
  // OpenNext compila Next.js con `node scripts/build.mjs --next` (ver open-next.config.ts) y empaqueta el
  // resultado como un Worker en `.open-next/`.
  run("npx", ["opennextjs-cloudflare", "build"], { KL_DEPLOY_TARGET: "cloudflare" });
} else {
  run("npx", ["next", "build"]);
}
