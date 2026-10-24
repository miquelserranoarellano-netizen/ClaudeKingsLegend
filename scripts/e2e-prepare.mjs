// Prepara la base de datos de las pruebas de extremo a extremo: borra la de la ejecución anterior y la
// rellena con el seed de demostración. Solo actúa sobre DATA_DIR (por defecto .data/e2e), nunca sobre la
// base de desarrollo.
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR || path.join(root, ".data", "e2e");
if (!path.resolve(dataDir).startsWith(path.join(root, ".data", "e2e"))) {
  console.error("DATA_DIR de las pruebas debe estar dentro de .data/e2e.");
  process.exit(1);
}
await rm(dataDir, { recursive: true, force: true });
const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--conditions=react-server", "scripts/seed.ts"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, DATA_DIR: dataDir },
});
process.exit(result.status ?? 1);
