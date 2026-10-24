import type { MessageKey } from "@/i18n";

/**
 * Error de negocio con un código estable y una clave de mensaje (traducible). Es lo único que llega al
 * usuario tal cual; cualquier otro error se registra en el servidor y se muestra un mensaje genérico, sin
 * detalles internos.
 */
export type AppErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "invalid_state"
  | "rate_limited";

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    readonly messageKey: MessageKey,
    readonly params: Record<string, string | number> = {},
    readonly fieldErrors?: Record<string, MessageKey>,
  ) {
    super(`${code}: ${messageKey}`);
    this.name = "AppError";
  }
}

export const forbidden = () => new AppError("forbidden", "errors.forbidden");
export const notFound = () => new AppError("not_found", "errors.notFound");
export const unauthenticated = () => new AppError("unauthenticated", "errors.unauthenticated");

/** Código de error de Postgres (los dos controladores lo exponen, a veces envuelto por Drizzle). */
export function pgErrorCode(error: unknown): string | undefined {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

/** Nombre de la restricción violada, si lo hay. */
export function pgConstraint(error: unknown): string | undefined {
  const e = error as { constraint?: unknown; cause?: { constraint?: unknown } } | null;
  const name = e?.constraint ?? e?.cause?.constraint;
  return typeof name === "string" ? name : undefined;
}

export const isUniqueViolation = (error: unknown) => pgErrorCode(error) === "23505";
