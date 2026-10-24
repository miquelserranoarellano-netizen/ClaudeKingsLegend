import { z } from "zod";
import { t } from "@/i18n";
import { fromDateTimeLocal } from "./format";

/**
 * Piezas de validación compartidas por el navegador y el servidor. El servidor siempre vuelve a validar:
 * lo que llega de un formulario se trata como no fiable.
 */

/** Texto obligatorio, recortado, con longitud mínima y máxima. */
export const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, { error: min <= 1 ? t("errors.required") : `Mínimo ${min} caracteres.` })
    .max(max, { error: `Máximo ${max} caracteres.` });

/** Texto opcional: cadena vacía → `null`. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres.` })
    .optional()
    .transform((value) => (value ? value : null));

export const integer = (min: number, max: number) =>
  z.coerce
    .number({ error: "Tiene que ser un número." })
    .int({ error: "Tiene que ser un número entero." })
    .min(min, { error: `Mínimo ${min}.` })
    .max(max, { error: `Máximo ${max}.` });

/** Casilla de un formulario: presente («on») → true. */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((value) => value === "on" || value === "true");

/** Fecha y hora de un `<input type="datetime-local">`, en la zona horaria de la plataforma. */
export const dateTimeLocal = z.string().transform((value, ctx) => {
  const date = fromDateTimeLocal(value);
  if (!date) {
    ctx.addIssue({ code: "custom", message: t("errors.invalidDate") });
    return z.NEVER;
  }
  return date;
});

export const optionalDateTimeLocal = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = fromDateTimeLocal(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: t("errors.invalidDate") });
      return z.NEVER;
    }
    return date;
  });

/** Enlace externo: solo https (evita `javascript:` y contenido mixto). */
export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    { error: t("errors.invalidUrl") },
  );

export const optionalHttpsUrl = z
  .union([z.literal(""), httpsUrl])
  .optional()
  .transform((value) => (value ? value : null));

export const uuid = z.uuid({ error: t("errors.notFound") });
