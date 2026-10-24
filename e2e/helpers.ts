import { expect, type Page } from "@playwright/test";

/** Contraseña de las cuentas del seed de demostración (solo desarrollo y pruebas). */
export const DEMO_PASSWORD = "demo-kings-legend";

export const ORGANIZER = "organiza@demo.kingslegend.test";
export const ADMIN = "admin@demo.kingslegend.test";
/** Capitán de «Lobos del Norte» en el seed. */
export const LOBOS_CAPTAIN = "jugador6@demo.kingslegend.test";

export async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Menú de la cuenta" }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("link", { name: "Entrar" }).first()).toBeVisible();
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}@e2e.kingslegend.test`;
}
