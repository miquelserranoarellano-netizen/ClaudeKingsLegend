"use client";

import { createAuthClient } from "better-auth/react";

/** Cliente de Better Auth para el navegador (mismo origen: las peticiones van a /api/auth). */
export const authClient = createAuthClient();

/** Traduce los códigos de error de Better Auth a mensajes para el usuario. */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (error?.status === 429) return "Demasiados intentos. Espera unos minutos.";
  if (message.includes("ACCOUNT_SUSPENDED")) return "Esta cuenta está suspendida. Si crees que es un error, escríbenos desde Contacto.";
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Correo o contraseña incorrectos.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Ya hay una cuenta con ese correo.";
    case "EMAIL_NOT_VERIFIED":
      return "Antes de entrar tienes que confirmar tu correo. Te hemos enviado un enlace.";
    case "PASSWORD_TOO_SHORT":
      return "La contraseña es demasiado corta.";
    case "PASSWORD_TOO_LONG":
      return "La contraseña es demasiado larga.";
    case "INVALID_TOKEN":
      return "El enlace no es válido o ha caducado. Pide uno nuevo.";
    case "INVALID_EMAIL":
      return "El correo no es válido.";
    default:
      return "No se ha podido completar. Vuelve a intentarlo.";
  }
}
