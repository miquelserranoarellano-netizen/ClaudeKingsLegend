import { expect, test } from "@playwright/test";
import { signOut, uniqueEmail } from "./helpers";

test.describe("cuentas", () => {
  test("registro, cierre de sesión y acceso", async ({ page }) => {
    const email = uniqueEmail("registro");
    const password = "una-frase-bastante-larga";

    await page.goto("/registro");
    await page.getByLabel("Nombre visible").fill("Jugadora E2E");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByLabel("Repite la contraseña").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Hola, Jugadora E2E" })).toBeVisible();

    await signOut(page);

    // Contraseña incorrecta: mensaje claro y sin pistas sobre si la cuenta existe.
    await page.goto("/acceso");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill("no-es-la-buena");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos." })).toBeVisible();

    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("el registro valida en el navegador antes de enviar", async ({ page }) => {
    await page.goto("/registro");
    await page.getByLabel("Nombre visible").fill("X");
    await page.getByLabel("Correo electrónico").fill(uniqueEmail("valida"));
    await page.getByLabel("Contraseña", { exact: true }).fill("corta");
    await page.getByLabel("Repite la contraseña").fill("distinta");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Entre 2 y 40 caracteres.")).toBeVisible();
    await expect(page.getByText("Al menos 10 caracteres.")).toBeVisible();
    await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
    await expect(page.getByText("Tienes que aceptar los términos para crear la cuenta.")).toBeVisible();
    await expect(page).toHaveURL(/\/registro/);
  });

  test("la recuperación de contraseña no revela si el correo existe", async ({ page }) => {
    await page.goto("/recuperar");
    await page.getByLabel("Correo electrónico de tu cuenta").fill("nadie@e2e.kingslegend.test");
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByRole("status")).toContainText("Si hay una cuenta con ese correo");
  });
});
