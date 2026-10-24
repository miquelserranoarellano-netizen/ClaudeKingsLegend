import "server-only";
import { after } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { t } from "@/i18n";
import type { ActionState } from "@/lib/action-state";
import { AppError, isUniqueViolation } from "./errors";
import { deliverPendingEmails } from "@/features/notifications/service";

/**
 * Envoltorio común de las acciones de servidor. Las acciones son endpoints públicos: cada una valida su
 * entrada con Zod y comprueba permisos en el servicio. Aquí se traduce el resultado a algo que el
 * formulario puede mostrar:
 * - `AppError` → su mensaje (y errores por campo).
 * - `ZodError` → «revisa los campos» con el detalle de cada campo.
 * - Violación de unicidad no prevista → mensaje de duplicado.
 * - Cualquier otra cosa → mensaje genérico; el detalle solo va al registro del servidor, sin datos del
 *   formulario (podría haber contraseñas o datos personales).
 * Las redirecciones y `notFound()` de Next se dejan pasar.
 */
export async function runAction<T = undefined>(
  name: string,
  fn: () => Promise<{ message?: string; data?: T } | void>,
): Promise<ActionState<T>> {
  try {
    const result = (await fn()) ?? {};
    // Los avisos por correo (si hay SMTP) se envían cuando la respuesta ya ha salido.
    after(() => deliverPendingEmails().catch((error) => console.error("[correo] envío diferido:", error?.message)));
    return { ok: true, message: result.message, data: result.data };
  } catch (error) {
    unstable_rethrow(error);
    return toFailure(name, error);
  }
}

export function toFailure(name: string, error: unknown): Extract<ActionState, { ok: false }> {
  if (error instanceof AppError) {
    const fieldErrors = error.fieldErrors
      ? Object.fromEntries(Object.entries(error.fieldErrors).map(([field, key]) => [field, t(key, error.params)]))
      : undefined;
    return { ok: false, error: t(error.messageKey, error.params), fieldErrors };
  }
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path.join(".") || "_";
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, error: t("errors.validation"), fieldErrors };
  }
  if (isUniqueViolation(error)) return { ok: false, error: t("errors.duplicate") };
  const err = error as { message?: string; stack?: string };
  console.error(`[acción ${name}] error inesperado:`, err?.message, err?.stack?.split("\n").slice(1, 4).join(" | "));
  return { ok: false, error: t("errors.unexpected") };
}

/**
 * Convierte un FormData en objeto para validarlo con Zod. Las claves repetidas se convierten en listas y
 * las que acaban en `[]` siempre son listas. Los archivos se dejan fuera (se leen aparte).
 */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (rawKey.startsWith("$ACTION")) continue;
    const isList = rawKey.endsWith("[]");
    const key = isList ? rawKey.slice(0, -2) : rawKey;
    if (isList) {
      out[key] = [...((out[key] as string[] | undefined) ?? []), value];
    } else if (key in out) {
      const current = out[key];
      out[key] = Array.isArray(current) ? [...current, value] : [current, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Primer archivo no vacío de un campo, o `null`. */
export function formFile(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

export function formFiles(formData: FormData, name: string): File[] {
  return formData.getAll(name).filter((v): v is File => v instanceof File && v.size > 0);
}
