"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import type { ActionState } from "@/lib/action-state";

export function ForgotPasswordForm() {
  const [state, setState] = useState<ActionState>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setPending(true);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/restablecer" });
    setPending(false);
    // Mismo mensaje exista o no la cuenta: así no se puede averiguar qué correos están registrados.
    setState(
      error?.status === 429
        ? { ok: false, error: authErrorMessage(error) }
        : { ok: true, message: "Si hay una cuenta con ese correo, te hemos enviado un enlace para restablecer la contraseña. Caduca en 1 hora." },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Correo electrónico de tu cuenta">{(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}</Field>
      <FormMessage state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<ActionState>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    const found: Record<string, string> = {};
    if (password.length < PASSWORD_MIN) found.password = `Al menos ${PASSWORD_MIN} caracteres.`;
    if (password.length > PASSWORD_MAX) found.password = `Como máximo ${PASSWORD_MAX} caracteres.`;
    if (password !== confirm) found.confirm = "Las contraseñas no coinciden.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    setState(
      error
        ? { ok: false, error: authErrorMessage(error) }
        : { ok: true, message: "Contraseña cambiada. Se han cerrado las sesiones abiertas en otros dispositivos." },
    );
  }

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Link href="/acceso" className="inline-flex font-semibold text-brand underline-offset-4 hover:underline">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Contraseña nueva" hint={`Al menos ${PASSWORD_MIN} caracteres.`} error={errors.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required />}
      </Field>
      <Field label="Repite la contraseña" error={errors.confirm}>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required />}
      </Field>
      <FormMessage state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        disabled={pending || !email}
        onClick={async () => {
          setPending(true);
          const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
          setPending(false);
          setState(error ? { ok: false, error: authErrorMessage(error) } : { ok: true, message: "Enlace reenviado. Revisa también la carpeta de spam." });
        }}
      >
        {pending ? "Enviando…" : "Reenviar el enlace"}
      </Button>
      <FormMessage state={state} />
    </div>
  );
}
