/** URL pública de la web, sin barra final. En producción debe definirse en `NEXT_PUBLIC_SITE_URL`. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL || "http://localhost:3400").replace(/\/$/, "");
}

export const SITE_NAME = "Kings Legend";
export const SITE_DESCRIPTION =
  "Plataforma de torneos y ligas de League of Legends: inscripciones de equipos, cuadros eliminatorios, calendarios, resultados y clasificaciones.";
