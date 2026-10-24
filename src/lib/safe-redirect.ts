/**
 * Solo se permite volver a rutas internas («/algo»), nunca a otro dominio («//evil.com», «https://…»):
 * evita redirecciones abiertas a partir del parámetro `next`.
 */
export function safeNext(next: string | string[] | undefined | null, fallback = "/dashboard"): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
