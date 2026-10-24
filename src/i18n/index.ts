import { es, type Messages } from "./messages/es";

export const locales = ["es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";

/** Etiqueta BCP 47 para `Intl` y el atributo `lang`. */
export const localeTags: Record<Locale, string> = { es: "es-ES" };

/** Zona horaria en la que se muestran fechas y horas (las fechas se guardan siempre en UTC). */
export const DISPLAY_TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "Europe/Madrid";

const dictionaries: Record<Locale, Messages> = { es };

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<typeof es>;

/** Idioma activo. Hoy siempre español; aquí se decidirá a partir de la cookie o la ruta. */
export function getLocale(): Locale {
  return defaultLocale;
}

export function translate(locale: Locale, key: MessageKey, params: Record<string, string | number> = {}): string {
  let node: unknown = dictionaries[locale];
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node !== "string") return key;
  return node.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(getLocale(), key, params);
}

/** Etiqueta de un valor enumerado: `label("format", "league")` → «Liga». */
export function label<G extends keyof Messages["enums"]>(group: G, value: keyof Messages["enums"][G] & string): string {
  return t(`enums.${group}.${value}` as MessageKey);
}
