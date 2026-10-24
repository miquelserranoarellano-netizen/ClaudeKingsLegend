import { expect, test } from "@playwright/test";
import { LOBOS_CAPTAIN, ORGANIZER, signIn, signOut, uniqueEmail } from "./helpers";

/** PNG de 64×64 píxeles (un cuadrado de color), para probar la subida de imágenes. */
const PNG_64x64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAe0lEQVR4nO3PUQkAIBTAwBfBPPYPYCRD+HEIgwW4zVn764YLGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLXjsAnxKoQAZ/4/9AAAAAElFTkSuQmCC";

test.describe("equipos", () => {
  test("crear un equipo, rechazar el nombre repetido e invitar", async ({ page }) => {
    const email = uniqueEmail("capitan");
    await page.goto("/registro");
    await page.getByLabel("Nombre visible").fill("Capitana E2E");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill("una-frase-bastante-larga");
    await page.getByLabel("Repite la contraseña").fill("una-frase-bastante-larga");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/dashboard/equipos/nuevo");
    await page.getByLabel("Nombre del equipo").fill("Equipo Prueba E2E");
    await page.getByLabel("Etiqueta").fill("E2E");
    // Logotipo: el navegador lo reduce y recodifica antes de subirlo; el servidor comprueba su tipo real.
    await page.locator('input[name="logo"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from(PNG_64x64, "base64") });
    await expect(page.getByAltText("Vista previa")).toBeVisible();
    await page.getByRole("button", { name: "Crear equipo" }).click();
    await expect(page).toHaveURL(/\/dashboard\/equipos\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: /Equipo Prueba E2E/ })).toBeVisible();
    const logo = page.locator('h1 img[src^="/media/"]');
    await expect(logo).toBeVisible();
    const media = await page.request.get((await logo.getAttribute("src"))!);
    expect(media.headers()["content-type"]).toBe("image/webp");
    expect(media.headers()["x-content-type-options"]).toBe("nosniff");

    // Nombre ya usado por un equipo activo del seed (sin distinguir mayúsculas).
    await page.goto("/dashboard/equipos/nuevo");
    await page.getByLabel("Nombre del equipo").fill("coronas de hierro");
    await page.getByLabel("Etiqueta").fill("XYZ");
    await page.getByRole("button", { name: "Crear equipo" }).click();
    await expect(page.getByText("Ya hay un equipo activo con ese nombre.").first()).toBeVisible();

    await page.goto("/dashboard/equipos");
    await page.getByRole("link", { name: /Equipo Prueba E2E/ }).click();
    await page.getByLabel("Identificador del jugador").fill("@demo-aurora");
    await page.getByRole("button", { name: "Enviar invitación" }).click();
    await expect(page.getByText("Invitación enviada a @demo-aurora.")).toBeVisible();
    await expect(page.getByText("@demo-aurora · caduca el")).toBeVisible();
  });
});

test.describe("torneos", () => {
  test("el capitán inscribe a su equipo y la organización lo aprueba", async ({ page }) => {
    await signIn(page, LOBOS_CAPTAIN);
    await page.goto("/torneos/open-primavera");
    for (const radio of await page.getByRole("radio", { name: "Titular" }).all()) await radio.check({ force: true });
    await page.getByRole("button", { name: "Inscribir al equipo" }).click();
    // El panel pasa a mostrar la inscripción y su estado.
    await expect(page.getByText("La organización revisará la inscripción y te avisaremos.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retirar inscripción" })).toBeVisible();
    await signOut(page);

    await signIn(page, ORGANIZER);
    await page.goto("/admin/torneos");
    await page.getByRole("link", { name: "Open Primavera" }).click();
    await page.getByRole("link", { name: /Inscripciones/ }).click();
    const card = page.locator("div.rounded-card", { hasText: "Lobos del Norte" });
    await card.getByRole("button", { name: "Aprobar" }).click();
    await expect(page.getByRole("region", { name: "Aprobadas" })).toContainText("Lobos del Norte");
  });

  test("el capitán comunica un resultado, la organización lo valida y el cuadro avanza", async ({ page }) => {
    await signIn(page, LOBOS_CAPTAIN);
    await page.goto("/dashboard/partidos");
    await page.getByRole("link", { name: "Copa Otoño Kings" }).first().click();
    await expect(page.getByRole("heading", { name: "Comunicar resultado" })).toBeVisible();
    await page.getByLabel("Lobos del Norte", { exact: true }).selectOption("1");
    await page.getByRole("button", { name: "Enviar resultado" }).click();
    await expect(page.getByText(/Comunicado por .* \(Lobos del Norte\)/)).toBeVisible();
    const matchUrl = page.url();
    await signOut(page);

    await signIn(page, ORGANIZER);
    await page.goto(matchUrl);
    await expect(page.getByText("Pendiente de validación").first()).toBeVisible();
    await page.getByRole("button", { name: "Validar este resultado" }).click();
    await expect(page.getByText("Confirmado", { exact: true }).first()).toBeVisible();

    await page.goto("/torneos/copa-otono-kings?vista=cuadro");
    await expect(page.getByRole("link", { name: "Coronas de Hierro contra Lobos del Norte" })).toBeVisible();
  });

  test("la organización crea y publica un torneo, que aparece en el explorador", async ({ page }) => {
    await signIn(page, ORGANIZER);
    await page.goto("/admin/torneos/nuevo");
    await page.getByLabel("Nombre").fill("Copa Pública E2E");
    await page.getByLabel("Resumen").fill("Creado por las pruebas automáticas.");
    await page.getByRole("button", { name: "Crear borrador" }).click();
    await expect(page.getByText("Borrador creado")).toBeVisible();
    await page.getByRole("button", { name: "Publicar torneo" }).click();
    await expect(page.getByText("Inscripciones abiertas").first()).toBeVisible();

    await page.goto("/torneos?q=P%C3%BAblica%20E2E");
    await expect(page.getByRole("link", { name: "Copa Pública E2E" })).toBeVisible();
  });
});
