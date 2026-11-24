import "server-only";

/**
 * Entrar con Google, solo si está configurado (`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, de un cliente
 * OAuth «Aplicación web» de Google Cloud; ver docs/DESPLIEGUE-CLOUDFLARE.md). Sin las dos claves el botón no
 * aparece: no se ofrece algo que fallaría.
 */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleProvider() {
  if (!isGoogleConfigured()) return undefined;
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // Deja elegir cuenta aunque el navegador tenga una sola abierta.
    prompt: "select_account" as const,
  };
}
