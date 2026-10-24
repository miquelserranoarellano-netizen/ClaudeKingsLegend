import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * Pruebas de extremo a extremo: `npm run test:e2e`.
 *
 * Arrancan su propio servidor de desarrollo en el puerto 3410 con una base de datos local separada
 * (`.data/e2e`, que se vacía y se rellena con el seed de demostración en cada ejecución), así que no
 * tocan tus datos de desarrollo. Usan el Chrome instalado en el equipo (sin descargar navegadores).
 */
const PORT = 3410;
const dataDir = path.join(__dirname, ".data", "e2e");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL ?? "chrome",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/e2e-prepare.mjs && node node_modules/next/dist/bin/next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { DATA_DIR: dataDir, BETTER_AUTH_URL: `http://localhost:${PORT}`, NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` },
  },
});
