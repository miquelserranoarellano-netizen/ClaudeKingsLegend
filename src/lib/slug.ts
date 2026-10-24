/** «Copa de Otoño 2026» → «copa-de-otono-2026». */
export function slugify(input: string, maxLength = 60): string {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "sin-nombre";
}

/** Sufijo corto aleatorio para desambiguar identificadores repetidos. */
export function randomSuffix(length = 4): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Identificador público de jugador a partir de su nombre visible (3-32 caracteres). */
export function handleFrom(name: string): string {
  let base = slugify(name, 28);
  if (base.length < 3) base = `jugador-${base}`.slice(0, 28);
  return base;
}

export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
