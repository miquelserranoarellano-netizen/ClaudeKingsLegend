import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("permisos", () => {
  test("sin sesión, el panel redirige al acceso y vuelve después", async ({ page }) => {
    await page.goto("/dashboard/equipos");
    await expect(page).toHaveURL(/\/acceso\?next=%2Fdashboard%2Fequipos/);
  });

  test("un jugador no ve la administración (responde como si no existiera)", async ({ page }) => {
    await signIn(page, "jugador20@demo.kingslegend.test");
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
    // Ni siquiera aparece el enlace en su menú.
    await page.getByRole("button", { name: "Menú de la cuenta" }).click();
    await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(0);
  });

  test("un organizador entra en la administración pero no en la de la plataforma", async ({ page }) => {
    await signIn(page, "organiza@demo.kingslegend.test");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
    const users = await page.goto("/admin/usuarios");
    expect(users?.status()).toBe(404);
  });

  test("un borrador no es visible para el público", async ({ page }) => {
    await signIn(page, "organiza@demo.kingslegend.test");
    await page.goto("/admin/torneos/nuevo");
    await page.getByLabel("Nombre").fill("Borrador secreto E2E");
    await page.getByRole("button", { name: "Crear borrador" }).click();
    await expect(page.getByText("Borrador creado")).toBeVisible();
    await page.getByRole("button", { name: "Menú de la cuenta" }).click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    const response = await page.goto("/torneos/borrador-secreto-e2e");
    expect(response?.status()).toBe(404);
  });
});
